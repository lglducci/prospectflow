import {createContext,useContext,useState,useEffect} from 'react';
const Context=createContext(null);
export function ThemeProvider({children}){
 const [dark,setDark]=useState(()=>{try{return localStorage.getItem('prospectflow-tema')!=='light';}catch{return true;}});
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('prospectflow-tema',dark?'dark':'light');}catch{}},[dark]);
 return <Context.Provider value={{dark,setDark}}>{children}</Context.Provider>;
}
export const useTheme=()=>useContext(Context);
export function ThemeButton(){const {dark,setDark}=useTheme();return <button type="button" className="secondary" onClick={()=>setDark(x=>!x)} aria-label={dark?'Usar tema claro':'Usar tema escuro'}>{dark?'☀ Claro':'☾ Escuro'}</button>;}
