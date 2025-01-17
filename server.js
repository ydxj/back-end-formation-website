import express from 'express'
import mysql from 'mysql'
import cors from 'cors'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'

const app = express()
app.use(cors())
app.use(express.json())
app.use(cookieParser())
app.use(bodyParser.json())
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie:{
        secure: false,
        maxAge: 1000*60*60*24,
    }
}))
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chu e-learning"
})
app.get('/courses',(req,res)=>{
    if(req.session.username){
        return res.json({valid:true,username: req.session.username,role: req.session.role})
    }else{
        return res.json({valid:false})
    }
})
app.post('/login',(req,res)=> {
    const sql = "SELECT * FROM Employee where email = ? and password = ?";
    db.query(sql,[req.body.email,req.body.password],(err,result)=>{
        if(err) return res.json({Message: "Error inside server"+err});
        if(result.length >0){
            req.session.username = result[0].username;
            req.session.role = result[0].role;
            return res.json({Login:true})
        }else{
            return res.json({Login:false})
        }
    })
})
app.listen(8081,()=>{
    console.log("You are connected to the server")
})