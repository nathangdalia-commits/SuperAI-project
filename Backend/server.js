require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL)
  .then(()=>console.log("MongoDB connecté"))
  .catch(err=>console.log("Erreur MongoDB:", err));

const MessageSchema = new mongoose.Schema({
  userId:String,
  from:String, // user | admin | ai
  text:String,
  timestamp:{type:Date,default:Date.now}
});

const Message = mongoose.model("Message",MessageSchema);

const openai = new OpenAI({apiKey:process.env.OPENAI_KEY});

// USER envoie message
app.post('/message', async(req,res)=>{
  const {userId,message} = req.body;
  await Message.create({userId,from:'user',text:message});
  res.json({ok:true});
});

// GET tous les utilisateurs
app.get('/users', async(req,res)=>{
  const users = await Message.distinct("userId");
  res.json(users.map(u=>({id:u})));
});

// GET messages par utilisateur
app.get('/messages/:id', async(req,res)=>{
  const msgs = await Message.find({userId:req.params.id});
  res.json(msgs);
});

// ADMIN réponse humaine
app.post('/reply', async(req,res)=>{
  const {user,text} = req.body;
  await Message.create({userId:user,from:'admin',text});
  res.json({ok:true});
});

// ADMIN IA réponse
app.post('/ai-reply', async(req,res)=>{
  const {user} = req.body;
  const last = await Message.find({userId:user,from:'user'}).sort({timestamp:-1}).limit(1);
  if(!last[0]) return res.json({error:true});

  const r = await openai.chat.completions.create({
    model:"gpt-4o-mini",
    messages:[{role:"user",content:last[0].text}]
  });

  const aiText = r.choices[0].message.content;
  await Message.create({userId:user,from:'ai',text:aiText});
  res.json({ok:true});
});

// USER récupère messages
app.get('/user-messages/:id', async(req,res)=>{
  const msgs = await Message.find({userId:req.params.id});
  res.json(msgs);
});

app.listen(3000, ()=>console.log("SuperAI backend running"));
