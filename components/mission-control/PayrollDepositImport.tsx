"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {usePlaidLink,type PlaidLinkOnSuccessMetadata} from "react-plaid-link";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {importPayrollDeposits,isLikelyPayrollDeposit,type ConnectedTransactionRecord} from "@/domain/resolvers/payroll-deposits";

const PLAID_WORKER_URL_RAW=process.env.NEXT_PUBLIC_PLAID_WORKER_URL||"https://lifeos-plaid-sandbox.phillipstg.workers.dev";
const PLAID_WORKER_URL=PLAID_WORKER_URL_RAW.endsWith("/")?PLAID_WORKER_URL_RAW.slice(0,-1):PLAID_WORKER_URL_RAW;

function parseRows(raw:string):ConnectedTransactionRecord[]{
 const parsed:unknown=JSON.parse(raw);
 if(Array.isArray(parsed))return parsed as ConnectedTransactionRecord[];
 if(parsed&&typeof parsed==="object"){
  const value=parsed as Record<string,unknown>;
  if(Array.isArray(value.transactions))return value.transactions as ConnectedTransactionRecord[];
  if(Array.isArray(value.data))return value.data as ConnectedTransactionRecord[];
  if(value.data&&typeof value.data==="object"&&Array.isArray((value.data as Record<string,unknown>).transactions))return (value.data as Record<string,unknown>).transactions as ConnectedTransactionRecord[];
 }
 throw new Error("Expected a JSON array of connected transaction records.");
}
async function readJson(response:Response):Promise<Record<string,unknown>>{
 const value:unknown=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(value&&typeof value==="object"&&typeof (value as Record<string,unknown>).error==="string"?(value as Record<string,unknown>).error as string:`Plaid request failed (HTTP ${response.status}).`);
 if(!value||typeof value!=="object")throw new Error("Unexpected response from the Plaid Worker.");
 return value as Record<string,unknown>;
}
function dateDaysAgo(days:number){const date=new Date();date.setDate(date.getDate()-days);return date.toISOString().slice(0,10);}

export default function PayrollDepositImport({db,onPersist}:{db:LifeOSDatabase;onPersist:(next:LifeOSDatabase,message:string)=>Promise<void>|void}){
 const [raw,setRaw]=useState("");const [balance,setBalance]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const [linkToken,setLinkToken]=useState<string|null>(null);const [pendingOpen,setPendingOpen]=useState(false);const [linkBusy,setLinkBusy]=useState(false);const [linkMessage,setLinkMessage]=useState("");
 const parsed=useMemo(()=>{if(!raw.trim())return {rows:[] as ConnectedTransactionRecord[],error:""};try{return {rows:parseRows(raw),error:""}}catch(e){return {rows:[] as ConnectedTransactionRecord[],error:e instanceof Error?e.message:"Invalid JSON"}}},[raw]);
 const matches=parsed.rows.filter(isLikelyPayrollDeposit);

 const handlePlaidSuccess=useCallback(async(publicToken:string,metadata:PlaidLinkOnSuccessMetadata)=>{
  setLinkBusy(true);setLinkMessage("");setError("");
  try{
   const exchanged=await readJson(await fetch(`${PLAID_WORKER_URL}/api/item/public-token/exchange`,{
    method:"POST",credentials:"include",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({public_token:publicToken})
   }));
   if(typeof exchanged.item_id!=="string"||!exchanged.item_id)throw new Error("Plaid linked the institution but the Worker did not return an item ID.");
   const transactions=await readJson(await fetch(`${PLAID_WORKER_URL}/api/transactions/get`,{
    method:"POST",credentials:"include",headers:{"Content-Type":"text/plain;charset=UTF-8"},
    body:JSON.stringify({item_id:exchanged.item_id,start_date:dateDaysAgo(730),end_date:new Date().toISOString().slice(0,10)})
   }));
   if(!Array.isArray(transactions.transactions))throw new Error("The account was linked, but the Worker did not return a transactions array.");
   const rows=transactions.transactions as ConnectedTransactionRecord[];
   setRaw(JSON.stringify(rows,null,2));
   const institution=metadata.institution?.name;
   setLinkMessage(`Connected${institution?` to ${institution}`:""}; loaded ${rows.length} transactions for review. Select Import payroll deposits to add matching posted payroll entries to LifeOS.`);
  }catch(e){
   setLinkMessage(e instanceof Error?e.message:"Plaid connection failed.");
  }finally{
   setLinkBusy(false);setLinkToken(null);
  }
 },[]);

 const {open,ready}=usePlaidLink({
  token:linkToken,
  onSuccess:(publicToken,metadata)=>{void handlePlaidSuccess(publicToken,metadata);},
  onExit:(err)=>{if(err)setLinkMessage(err.display_message||err.error_message||"Plaid Link closed with an error.");setPendingOpen(false);setLinkToken(null);setLinkBusy(false);}
 });
 useEffect(()=>{if(pendingOpen&&linkToken&&ready){setPendingOpen(false);open();}},[pendingOpen,linkToken,ready,open]);

 async function connectPlaid(){
  setError("");setLinkMessage("");setLinkBusy(true);setPendingOpen(true);
  try{
   const response=await readJson(await fetch(`${PLAID_WORKER_URL}/api/link/token/create`,{
    method:"POST",credentials:"include",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({})
   }));
   if(typeof response.link_token!=="string"||!response.link_token)throw new Error("The Plaid Worker did not return a Link token.");
   setLinkToken(response.link_token);
  }catch(e){
   setPendingOpen(false);setLinkBusy(false);
   setLinkMessage(e instanceof Error?e.message:"Could not start Plaid Link.");
  }
 }

 async function importNow(){
  setError("");setBusy(true);
  try{
   if(parsed.error)throw new Error(parsed.error);
   if(!matches.length)throw new Error("No posted payroll deposits found. The selected institution may not have payroll transactions in this date range.");
   const currentBalanceMinor=balance.trim()?Math.round(Number(balance)*100):undefined;
   if(balance.trim()&&(currentBalanceMinor==null||!Number.isFinite(currentBalanceMinor)||currentBalanceMinor<0))throw new Error("Enter a valid non-negative current checking balance.");
   const result=importPayrollDeposits(db,parsed.rows,new Date().toISOString(),currentBalanceMinor);
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
  <p className="row-meta">Connect through Plaid Link to retrieve transactions from your linked institution. LifeOS reviews the returned transaction history, imports matching Kia Georgia payroll deposits, deduplicates them, and uses the history to estimate the next payday.</p>
  <button className="action primary" type="button" disabled={linkBusy} onClick={()=>void connectPlaid()}>{linkBusy?"Connecting…":"Connect bank with Plaid"}</button>
  {linkMessage&&<div className="row-meta" role="status">{linkMessage}</div>}
  <p className="row-meta">If Plaid connection is not available, you can still use the manual import below. Your Plaid secret and access tokens remain on the protected Worker; they are not shown in this page.</p>
  <label className="field-label">Connected transaction JSON<textarea className="command-input capture-body" rows={5} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={'[{"date":"2026-09-25","amount":-2983.35,"name":"KIA GEORGIA INC. PAYROLL","transaction_id":"..."}]'}/></label>
  <div className="row-meta">{parsed.error?parsed.error:`${parsed.rows.length} rows loaded · ${matches.length} posted payroll deposit matches`}</div>
  <label className="field-label">Current USAA checking balance (optional, dollars)<input className="command-input" inputMode="decimal" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="Enter current available balance to anchor the cash forecast"/></label>
  <div className="row-meta">Imported deposit history is marked as historical evidence and excluded from cash-balance arithmetic, so partial imports do not inflate your available cash. Entering a current balance anchors the forecast.</div>
  {error&&<div className="notice" role="alert">{error}</div>}
  <button className="action primary" type="button" disabled={busy||!raw.trim()||Boolean(parsed.error)||!matches.length} onClick={()=>void importNow()}>{busy?"Importing…":"Import payroll deposits"}</button>
 </section>;
}
