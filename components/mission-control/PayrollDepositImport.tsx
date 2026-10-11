"use client";
import {useMemo,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {importPayrollDeposits,isLikelyPayrollDeposit,type ConnectedTransactionRecord} from "@/domain/resolvers/payroll-deposits";

function parseRows(raw:string):ConnectedTransactionRecord[]{
 const parsed:unknown=JSON.parse(raw);
 if(Array.isArray(parsed))return parsed as ConnectedTransactionRecord[];
 if(parsed&&typeof parsed==="object"){
  const value=parsed as Record<string,unknown>;
  if(Array.isArray(value.transactions))return value.transactions as ConnectedTransactionRecord[];
  if(Array.isArray(value.data))return value.data as ConnectedTransactionRecord[];
  if(value.data&&typeof value.data==="object"&&Array.isArray((value.data as Record<string,unknown>).transactions))return (value.data as Record<string,unknown>).transactions as ConnectedTransactionRecord[];
 }
 throw new Error("Paste a JSON array of connected transaction records, or an object containing a transactions array.");
}
export default function PayrollDepositImport({db,onPersist}:{db:LifeOSDatabase;onPersist:(next:LifeOSDatabase,message:string)=>Promise<void>|void}){
 const [raw,setRaw]=useState("");const [balance,setBalance]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const parsed=useMemo(()=>{if(!raw.trim())return {rows:[] as ConnectedTransactionRecord[],error:""};try{return {rows:parseRows(raw),error:""}}catch(e){return {rows:[] as ConnectedTransactionRecord[],error:e instanceof Error?e.message:"Invalid JSON"}}},[raw]);
 const matches=parsed.rows.filter(isLikelyPayrollDeposit);
 async function importNow(){
  setError("");setBusy(true);
  try{
   if(parsed.error)throw new Error(parsed.error);
   if(!matches.length)throw new Error("No posted payroll deposits found. Include name/merchant_name and amount/date fields from the connected transaction records.");
   const currentBalanceMinor=balance.trim()?Math.round(Number(balance)*100):undefined;
   if(balance.trim()&&(!Number.isFinite(currentBalanceMinor)||currentBalanceMinor!<0))throw new Error("Enter a valid non-negative current checking balance.");
   const result=importPayrollDeposits(db,parsed.rows,new Date().toISOString(),currentBalanceMinor);
   if(result.account&&!db.accounts.some(a=>a.id===result.account!.id))db= {...db,accounts:[...db.accounts,result.account]};
   const next=structuredClone(db);
   if(result.account){
    const existing=next.accounts.find(a=>a.id===result.account!.id);
    if(existing&&currentBalanceMinor!=null)existing.openingBalanceMinor=currentBalanceMinor;
    else if(!existing)next.accounts.push(result.account);
   }
   next.transactions.push(...result.transactions);
   if(!result.imported&&currentBalanceMinor==null)throw new Error("Every matching deposit was already imported. No changes made.");
   await onPersist(next,`Payroll import complete: ${result.imported} added, ${result.duplicates} duplicates skipped, ${result.ignored} non-payroll rows ignored.${currentBalanceMinor!=null?" Current USAA checking balance updated.":""}`);
   setRaw("");setBalance("");
  }catch(e){setError(e instanceof Error?e.message:"Import failed.");}
  finally{setBusy(false);}
 }
 return <section className="card payroll-deposit-import">
  <div className="section-title"><div><div className="kicker">Finance / Connected Deposits</div><h2>Payroll Deposit Connector</h2></div><span className="badge">{db.transactions.filter(t=>t.metadata?.payrollDeposit===true).length} imported</span></div>
  <p className="row-meta">Paste a JSON transaction array copied from your connected finance records. LifeOS matches Kia Georgia payroll deposits, deduplicates them, and uses the history to estimate the next payday. This bridge does not have direct access to ChatGPT’s connector session.</p>
  <label className="field-label">Connected transaction JSON<textarea className="command-input capture-body" rows={5} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={'[{"date":"2026-09-25","amount":-2983.35,"name":"KIA GEORGIA INC. PAYROLL","transaction_id":"..."}]'}/></label>
  <div className="row-meta">{parsed.error?parsed.error:`${parsed.rows.length} rows pasted · ${matches.length} posted payroll deposit matches`}</div>
  <label className="field-label">Current USAA checking balance (optional, dollars)<input className="command-input" inputMode="decimal" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="Enter current available balance to anchor the cash forecast"/></label>
  <div className="row-meta">Imported deposit history is marked as historical evidence and excluded from cash-balance arithmetic, so partial imports do not inflate your available cash. Entering a current balance anchors the forecast.</div>
  {error&&<div className="notice">{error}</div>}
  <button className="action primary" type="button" disabled={busy||!raw.trim()||Boolean(parsed.error)||!matches.length} onClick={()=>void importNow()}>{busy?"Importing…":"Import payroll deposits"}</button>
 </section>;
}
