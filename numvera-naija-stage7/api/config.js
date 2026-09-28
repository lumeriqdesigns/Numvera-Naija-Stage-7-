export default function handler(req,res){
  if(req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const url=process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey=process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return res.status(200).json({supabaseUrl:url,supabaseAnonKey:anonKey,configured:Boolean(url && anonKey)});
}
