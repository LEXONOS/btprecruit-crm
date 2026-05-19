/* NOVALEM CRM — Vérification auth (chargé en premier) */
// Auth check
(function(){
  const s=sessionStorage.getItem('novalem_user');
  if(!s){window.location.href='/';return;}
  try{
    const u=JSON.parse(s);
    if(!u||!u.id||(Date.now()-u.ts)>8*3600000){
      sessionStorage.removeItem('novalem_user');
      window.location.href='/';return;
    }
    window.CURRENT_USER=u;
  }catch(e){window.location.href='/';}
  if(sessionStorage.getItem('btprecruit_auth')&&!window.CURRENT_USER){
    window.CURRENT_USER={id:'louis',name:'Louis Renault',role:'admin',initials:'LR',color:'#c8e040'};
  }
})();
