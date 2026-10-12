import {createContext,useContext,useState,useEffect,useCallback} from 'react';
import {jsonRequest,setCsrfToken} from '../lib/http';
import {buildWebhookUrl} from '../config/globals';
const AuthContext=createContext(null);
export function AuthProvider({children}) {
 const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const apply=useCallback(data=>{
  if(!data.usuario?.id || !Number.isSafeInteger(data.empresa?.id) || data.empresa.id<=0 || !data.csrf_token) throw new Error('Sessão inválida: verifique o contrato do endpoint de autenticação.');
  setCsrfToken(data.csrf_token);setSession({usuario:data.usuario,empresa:data.empresa});setError('');
 },[]);
 const clear=useCallback(()=>{setCsrfToken('');setSession(null);},[]);
 const restore=useCallback(async()=>{setLoading(true);try{apply(await jsonRequest(buildWebhookUrl('prospectflow-auth-sessao'),undefined,'GET'));}catch(e){clear();setError(e.message);}finally{setLoading(false);}},[apply,clear]);
 useEffect(()=>{restore();const expired=()=>{clear();setError('Sua sessão terminou. Entre novamente.');};window.addEventListener('prospectflow:unauthorized',expired);return()=>window.removeEventListener('prospectflow:unauthorized',expired);},[restore,clear]);
 async function login(email,senha){apply(await jsonRequest(buildWebhookUrl('prospectflow-auth-login'),{email,senha}));}
 async function logout(){await jsonRequest(buildWebhookUrl('prospectflow-auth-sair'),{});clear();}
 return <AuthContext.Provider value={{session,loading,error,login,logout,restore}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
