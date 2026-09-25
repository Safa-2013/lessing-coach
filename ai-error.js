export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  // Production note: connect this endpoint to the shared admin datastore/email.
  // It intentionally returns success so the student never sees internal details.
  return res.status(200).json({ok:true});
}
