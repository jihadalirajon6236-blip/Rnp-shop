const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";
const SHOP_PHONE = process.env.SHOP_PHONE || "01981796663";
const SHOP_WHATSAPP = process.env.SHOP_WHATSAPP || "8801981796663";

const db = new sqlite3.Database(path.join(__dirname, "shop.db"));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    note TEXT,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'new',
    payment_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req,res)=>res.json({ok:true,shop:"RNP SHOP"}));

app.post("/api/orders",(req,res)=>{
  const {customer_name,phone,address,payment_method,note="",items=[],total=0}=req.body||{};
  if(!customer_name||!phone||!address||!payment_method||!Array.isArray(items)||!items.length)
    return res.status(400).json({error:"Required order information is missing."});
  const orderNo="RNP-"+Date.now().toString().slice(-8);
  db.run(`INSERT INTO orders
    (order_no,customer_name,phone,address,payment_method,note,items,total)
    VALUES (?,?,?,?,?,?,?,?)`,
    [orderNo,String(customer_name).trim(),String(phone).trim(),String(address).trim(),
     String(payment_method),String(note),JSON.stringify(items),Number(total)||0],
    function(err){
      if(err){console.error(err);return res.status(500).json({error:"Could not save order."});}
      res.json({success:true,order_no:orderNo,id:this.lastID,
        shop_phone:SHOP_PHONE,shop_whatsapp:SHOP_WHATSAPP});
    });
});

function adminAuth(req,res,next){
  if(req.get("x-admin-key")!==ADMIN_KEY) return res.status(401).json({error:"Unauthorized"});
  next();
}

app.get("/api/orders",adminAuth,(req,res)=>{
  db.all("SELECT * FROM orders ORDER BY id DESC",[],(err,rows)=>{
    if(err){console.error(err);return res.status(500).json({error:"Could not load orders."});}
    res.json(rows);
  });
});

app.patch("/api/orders/:id",adminAuth,(req,res)=>{
  const {status,payment_status}=req.body||{};
  const statuses=["new","processing","delivered","cancelled"];
  const payments=["pending","paid","failed"];
  if(status!==undefined&&!statuses.includes(status)) return res.status(400).json({error:"Invalid status."});
  if(payment_status!==undefined&&!payments.includes(payment_status)) return res.status(400).json({error:"Invalid payment status."});

  db.get("SELECT * FROM orders WHERE id=?",[req.params.id],(err,row)=>{
    if(err)return res.status(500).json({error:"Database error."});
    if(!row)return res.status(404).json({error:"Order not found."});
    db.run("UPDATE orders SET status=?,payment_status=? WHERE id=?",
      [status!==undefined?status:row.status,
       payment_status!==undefined?payment_status:row.payment_status,
       req.params.id],
      e=>e?res.status(500).json({error:"Could not update order."}):res.json({success:true}));
  });
});

app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.get("/order.html",(req,res)=>res.sendFile(path.join(__dirname,"order.html")));
app.get("/admin.html",(req,res)=>res.sendFile(path.join(__dirname,"admin.html")));

app.listen(PORT,"0.0.0.0",()=>console.log(`RNP SHOP running on port ${PORT}`));
