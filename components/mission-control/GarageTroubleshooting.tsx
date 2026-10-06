"use client";
import {useMemo,useState} from "react";
import {
  SCION_XB_TROUBLESHOOTING,
  SCION_XB_DTC_CARDS,
  SCION_XB_SERVICE_CARDS,
  SCION_XB_CONNECTORS,
  SCION_XB_MAINTENANCE,
  SCION_XB_MANUAL_SECTIONS,
  SCION_XB_TORQUE_CARDS,
  type ScionXbManualLink,
} from "@/domain/data/garage-troubleshooting";
import {SUBARU_CROSSTREK_2019_PROFILE,SUBARU_CROSSTREK_TROUBLESHOOTING,SUBARU_CROSSTREK_QUICK_SPECS,SUBARU_CROSSTREK_TORQUES,SUBARU_CROSSTREK_OBD_CODES,SUBARU_CROSSTREK_DIAGNOSTIC_LINKS} from "@/domain/data/subaru-crosstrek-troubleshooting";
import {
  SUBARU_CROSSTREK_DTC_CARDS,
  SUBARU_CROSSTREK_TORQUE_CARDS,
  SUBARU_CROSSTREK_FLUID_SERVICE,
  SUBARU_CROSSTREK_CONNECTORS,
  SUBARU_CROSSTREK_MAINTENANCE,
  SUBARU_CROSSTREK_MANUAL_SECTIONS,
  SUBARU_CROSSTREK_SERVICE_SOURCE_NOTE,
  type SubaruManualLink
} from "@/domain/data/subaru-crosstrek-service";

type SubaruTab = "assistant" | "diagnose" | "dtc" | "service" | "torque" | "wiring" | "maintenance" | "manual";
type ScionTab = "diagnose" | "dtc" | "service" | "torque" | "wiring" | "maintenance" | "manual";
type ManualLink = SubaruManualLink | ScionXbManualLink;

const ManualLinks = ({ links }: { links: ManualLink[] }) => (
  <div className="garage-chip-list">
    {links.map((l, i) => (
      <a 
        className="garage-chip" 
        key={l.url + i} 
        href={l.url} 
        target="_blank" 
        rel="noreferrer"
      >
        {l.label} ↗
      </a>
    ))}
  </div>
);

export default function GarageTroubleshooting({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState<"scion" | "subaru">("scion");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(SCION_XB_TROUBLESHOOTING[0]?.id ?? "");
  const [tab, setTab] = useState<SubaruTab>("assistant");\n  const [selectedAssistantId, setSelectedAssistantId] = useState(SUBARU_ASSISTANT_CARDS[0]?.id ?? "");
  const [selectedDtc, setSelectedDtc] = useState(SUBARU_CROSSTREK_DTC_CARDS[0]?.code ?? "");
  const [selectedConnector, setSelectedConnector] = useState(SUBARU_CROSSTREK_CONNECTORS[0]?.connector ?? "");
  const [scionTab, setScionTab] = useState<ScionTab>("diagnose");
  const [selectedScionDtc, setSelectedScionDtc] = useState(SCION_XB_DTC_CARDS[0]?.code ?? "");
  const [selectedScionConnector, setSelectedScionConnector] = useState(SCION_XB_CONNECTORS[0]?.connector ?? "");
  const paths = vehicle === "subaru" ? SUBARU_CROSSTREK_TROUBLESHOOTING : SCION_XB_TROUBLESHOOTING;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return paths;
    return paths.filter(p =>
      [p.symptom, p.system, ...p.triggers, ...p.likelyCauses]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, paths]);
  const selected = matches.find(p => p.id === selectedId) ?? matches[0];
  const dtcMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUBARU_CROSSTREK_DTC_CARDS;
    return SUBARU_CROSSTREK_DTC_CARDS.filter(x =>
      [x.code, x.title, x.driveability, ...x.likelyCauses, ...x.firstChecks]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);
  const selectedDtcCard = dtcMatches.find(x => x.code === selectedDtc) ?? dtcMatches[0];
  const connectorMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUBARU_CROSSTREK_CONNECTORS;
    return SUBARU_CROSSTREK_CONNECTORS.filter(x =>
      [x.connector, x.connectsTo, x.use, x.area, x.color]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);
  const selectedConnectorCard = connectorMatches.find(x => x.connector === selectedConnector) ?? connectorMatches[0];
  const assistantMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUBARU_ASSISTANT_CARDS;
    return SUBARU_ASSISTANT_CARDS.filter(x => SUBARU_ASSISTANT_SEARCH_FIELDS(x).includes(q));
  }, [query]);
  const selectedAssistantCard = assistantMatches.find(x => x.id === selectedAssistantId) ?? assistantMatches[0];

  const scionDtcMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SCION_XB_DTC_CARDS;
    return SCION_XB_DTC_CARDS.filter(x =>
      [x.code, x.title, x.driveability, ...x.likelyCauses, ...x.firstChecks]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);
  const selectedScionDtcCard = scionDtcMatches.find(x => x.code === selectedScionDtc) ?? scionDtcMatches[0];
  const scionConnectorMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SCION_XB_CONNECTORS;
    return SCION_XB_CONNECTORS.filter(x =>
      [x.connector, x.connectsTo, x.use, x.area]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);
  const selectedScionConnectorCard = scionConnectorMatches.find(x => x.connector === selectedScionConnector) ?? scionConnectorMatches[0];
  const switchVehicle = (next: "scion" | "subaru") => {
    setVehicle(next);
    setQuery("");
    setTab(next === "subaru" ? "assistant" : "diagnose");
    setSelectedId((next === "subaru" ? SUBARU_CROSSTREK_TROUBLESHOOTING : SCION_XB_TROUBLESHOOTING)[0]?.id ?? "");
  };
  const subaruNav = (next: SubaruTab) => {
    setTab(next);
    setQuery("");
  };
  const scionNav = (next: ScionTab) => {
    setScionTab(next);
    setQuery("");
  };
  return <>
    <button type="button" className="action garage-guide-trigger" onClick={() => setOpen(true)}>🧭 Factory Diagnostic Guide <span>{paths.length}</span></button>
    {open && <div className="garage-guide-modal" role="dialog" aria-modal="true" aria-labelledby="garage-guide-title" onMouseDown={() => setOpen(false)}>
      <section className="garage-troubleshooting garage-guide-panel" onMouseDown={e => e.stopPropagation()}>
        <div className="garage-troubleshooting-head"><div><div className="kicker">Factory Diagnostic Guide</div><h3 id="garage-guide-title">{vehicle === "subaru" ? "2019 Subaru Crosstrek · FB20 / CVT" : "Symptom → Diagnostic Path"}</h3><p className="row-meta">{vehicle === "subaru" ? SUBARU_CROSSTREK_2019_PROFILE.year + " " + SUBARU_CROSSTREK_2019_PROFILE.make + " " + SUBARU_CROSSTREK_2019_PROFILE.model + " · " + SUBARU_CROSSTREK_2019_PROFILE.engine + " · " + SUBARU_CROSSTREK_2019_PROFILE.transmission : "2006 Scion xB · 1NZ-FE · factory repair-manual references"}</p></div><div className="row-actions"><span className="badge">{vehicle === "subaru" ? SUBARU_ASSISTANT_CARDS.length + " Assistant cards" : paths.length}</span><button type="button" className="mini-action" onClick={() => { setOpen(false); onClose?.(); }}>Close</button></div></div>
        <div className="garage-guide-tabs"><button type="button" className={"mini-action " + (vehicle === "scion" ? "active" : "")} onClick={() => switchVehicle("scion")}>Scion xB</button><button type="button" className={"mini-action " + (vehicle === "subaru" ? "active" : "")} onClick={() => switchVehicle("subaru")}>2019 Subaru Crosstrek</button></div>
        {vehicle === "subaru" && <div className="garage-guide-tabs" role="tablist" aria-label="Subaru service knowledge"><button className={"mini-action " + (tab === "assistant" ? "active" : "")} onClick={() => subaruNav("assistant")}>Assistant</button><button className={"mini-action " + (tab === "diagnose" ? "active" : "")} onClick={() => subaruNav("diagnose")}>Diagnose</button><button className={"mini-action " + (tab === "dtc" ? "active" : "")} onClick={() => subaruNav("dtc")}>DTC Cards · {SUBARU_CROSSTREK_DTC_CARDS.length}</button><button className={"mini-action " + (tab === "service" ? "active" : "")} onClick={() => subaruNav("service")}>Fluids / Service</button><button className={"mini-action " + (tab === "torque" ? "active" : "")} onClick={() => subaruNav("torque")}>Torque</button><button className={"mini-action " + (tab === "wiring" ? "active" : "")} onClick={() => subaruNav("wiring")}>Wiring</button><button className={"mini-action " + (tab === "maintenance" ? "active" : "")} onClick={() => subaruNav("maintenance")}>Maintenance</button><button className={"mini-action " + (tab === "manual" ? "active" : "")} onClick={() => subaruNav("manual")}>Manual</button></div>}
        {vehicle === "subaru" && tab === "assistant" && <div className="garage-assistant">
          <div className="garage-assistant-head">
            <div>
              <div className="kicker">Subaru Diagnostic Intelligence</div>
              <h4>Garage Assistant · 2019 Crosstrek</h4>
              <p className="row-meta">Search codes, symptoms, torque, maintenance, specifications, rules, and driveability in one touch-first library.</p>
            </div>
            <span className="badge">{assistantMatches.length} cards</span>
          </div>
          <div className="garage-guide-tabs" role="toolbar" aria-label="Subaru quick actions">
            <button type="button" className="mini-action" onClick={() => { setQuery(""); setSelectedAssistantId("no-crank"); }}>Start Diagnosis</button>
            <button type="button" className="mini-action" onClick={() => { setQuery("P"); }}>Scan Code</button>
            <button type="button" className="mini-action" onClick={() => { setQuery("torque"); }}>Lookup Torque</button>
            <button type="button" className="mini-action" onClick={() => { setQuery("fluid"); }}>Lookup Fluid</button>
            <button type="button" className="mini-action" onClick={() => subaruNav("maintenance")}>Maintenance</button>
          </div>
          <div className="garage-assistant-grid">
            {assistantMatches.map(card => <button type="button" key={card.id} className={"garage-assistant-card " + (selectedAssistantCard?.id === card.id ? "active" : "")} onClick={() => setSelectedAssistantId(card.id)}>
              <div className="garage-assistant-card-top"><span className={"garage-assistant-severity severity-" + (card.severity ?? "BLUE").toLowerCase()}>{card.severity ?? "BLUE"}</span><span className="row-meta">{card.type.replace("_"," ")}</span></div>
              <strong>{card.title}</strong>
              {card.quickAnswer && <span>{card.quickAnswer}</span>}
              {card.description && <span className="row-meta">{card.description}</span>}
            </button>)}
          </div>
          {selectedAssistantCard && <div className="garage-assistant-detail">
            <div className="garage-assistant-detail-head"><div><div className="kicker">{selectedAssistantCard.type.replace("_"," ")} · {selectedAssistantCard.severity ?? "BLUE"}</div><h4>{selectedAssistantCard.title}</h4></div><span className={"garage-assistant-severity severity-" + (selectedAssistantCard.severity ?? "BLUE").toLowerCase()}>{selectedAssistantCard.message ?? selectedAssistantCard.canDrive ?? "REFERENCE"}</span></div>
            {selectedAssistantCard.quickAnswer && <div className="garage-assistant-answer"><strong>Quick Answer</strong><span>{selectedAssistantCard.quickAnswer}</span></div>}
            {selectedAssistantCard.workflow?.length ? <div className="garage-troubleshooting-block"><div className="field-label">Action Steps</div><ol>{selectedAssistantCard.workflow.map((x,i)=><li key={i}>{x}</li>)}</ol></div> : null}
            {selectedAssistantCard.actionSteps?.length ? <div className="garage-troubleshooting-block"><div className="field-label">Actions</div><div className="garage-chip-list">{selectedAssistantCard.actionSteps.map((x,i)=><button type="button" className="garage-chip" key={i} onClick={() => setQuery(x)}>{x}</button>)}</div></div> : null}
            {selectedAssistantCard.commonCauses?.length ? <div className="garage-troubleshooting-block"><div className="field-label">Common Causes</div><div className="garage-chip-list">{selectedAssistantCard.commonCauses.map((x,i)=><span className="garage-chip" key={i}>{x}</span>)}</div></div> : null}
            {selectedAssistantCard.reasons?.length ? <div className="garage-troubleshooting-block"><div className="field-label">Why This Matters</div><ol>{selectedAssistantCard.reasons.map((x,i)=><li key={i}>{x}</li>)}</ol></div> : null}
            {selectedAssistantCard.specifications && <div className="garage-troubleshooting-block"><div className="field-label">Specifications</div><div className="garage-spec-list">{Object.entries(selectedAssistantCard.specifications).map(([k,v])=><div className="garage-spec" key={k}><strong>{k}</strong><span>{v}</span></div>)}</div></div>}
            {selectedAssistantCard.relatedDiagnostics?.length ? <div className="garage-troubleshooting-block"><div className="field-label">Related Diagnostics</div><div className="garage-chip-list">{selectedAssistantCard.relatedDiagnostics.map((x,i)=><button type="button" className="garage-chip" key={i} onClick={() => setQuery(x)}>{x}</button>)}</div></div> : null}
            {selectedAssistantCard.interval && <div className="garage-spec"><strong>Interval</strong><span>{selectedAssistantCard.interval}</span></div>}
            {selectedAssistantCard.notes?.length ? <div className="garage-troubleshooting-block"><div className="field-label">Notes</div><ul>{selectedAssistantCard.notes.map((x,i)=><li key={i}>{x}</li>)}</ul></div> : null}
            {selectedAssistantCard.manual?.length ? <div className="garage-troubleshooting-block"><div className="field-label">Factory Manual</div><ManualLinks links={selectedAssistantCard.manual} /></div> : null}
          </div>}
        </div>}

        {vehicle === "subaru" && tab === "diagnose" && <div className="garage-quick-reference"><div><div className="field-label">Quick specifications</div>{SUBARU_CROSSTREK_QUICK_SPECS.map((x, i) => <span className="garage-chip" key={i}>{x}</span>)}</div><div><div className="field-label">Torque reference</div>{SUBARU_CROSSTREK_TORQUES.map((x, i) => <span className="garage-chip" key={i}>{x}</span>)}</div><div><div className="field-label">OBD / severity reference</div>{SUBARU_CROSSTREK_OBD_CODES.map(([code, desc, severity]) => <button type="button" className="garage-chip" key={code} onClick={() => { setSelectedDtc(code); setTab("dtc"); }}>{code} · {severity} · {desc}</button>)}</div></div>}
        {vehicle === "subaru" && tab !== "manual" && <input className="command-input garage-troubleshooting-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this service library…" aria-label="Search Subaru service library" />}


        {vehicle === "subaru" && tab === "dtc" && <div className="garage-troubleshooting-layout"><div className="garage-troubleshooting-list" role="listbox" aria-label="Subaru DTC cards">{dtcMatches.map(x => <button type="button" key={x.code} className={"garage-troubleshooting-item " + (selectedDtcCard?.code === x.code ? "active" : "")} onClick={() => setSelectedDtc(x.code)}><span className="garage-troubleshooting-system">{x.severity} · {x.driveability.split(" — ")[0]}</span><strong>{x.code}</strong><span>{x.title}</span></button>)}</div>{selectedDtcCard && <div className="garage-troubleshooting-detail"><div className="kicker">DTC · {selectedDtcCard.severity}</div><h4>{selectedDtcCard.code} — {selectedDtcCard.title}</h4><div className="garage-chip-list"><span className="garage-chip">Driveability: {selectedDtcCard.driveability}</span><span className="garage-chip">Diagnose before replacement</span></div><div className="garage-troubleshooting-grid"><div className="garage-troubleshooting-block"><div className="field-label">First checks</div><ol>{selectedDtcCard.firstChecks.map((x, i) => <li key={i}>{x}</li>)}</ol></div><div className="garage-troubleshooting-block"><div className="field-label">Likely causes</div><ol>{selectedDtcCard.likelyCauses.map((x, i) => <li key={i}>{x}</li>)}</ol></div></div>{selectedDtcCard.wiring.length > 0 && <div className="garage-troubleshooting-block"><div className="field-label">Wiring / connector evidence</div><div className="garage-spec-list">{selectedDtcCard.wiring.map((x, i) => <div className="garage-spec" key={i}>{x}</div>)}</div></div>}{selectedDtcCard.specs.length > 0 && <div className="garage-troubleshooting-block"><div className="field-label">Critical specifications</div><div className="garage-spec-list">{selectedDtcCard.specs.map((x, i) => <div className="garage-spec" key={i}>{x}</div>)}</div></div>}<div className="garage-troubleshooting-block"><div className="field-label">Factory manual sections</div><ManualLinks links={selectedDtcCard.manual} /></div></div>}</div>}

        {vehicle === "subaru" && tab === "service" && <div className="garage-spec-list">{SUBARU_CROSSTREK_FLUID_SERVICE.filter(x => !query || [x.system, x.fluid, x.service, x.interval, ...x.specs].join(" ").toLowerCase().includes(query.toLowerCase())).map(x => <div className="garage-spec" key={x.system}><strong>{x.system}</strong><div>{x.fluid}</div><div>{x.service}</div><div className="row-meta">{x.interval}</div><div className="row-meta">{x.specs.join(" · ")}</div><ManualLinks links={x.manual} /></div>)}</div>}

        {vehicle === "subaru" && tab === "torque" && <div className="garage-spec-list">{SUBARU_CROSSTREK_TORQUE_CARDS.filter(x => !query || [x.item, x.torque, x.notes].join(" ").toLowerCase().includes(query.toLowerCase())).map(x => <div className="garage-spec" key={x.item}><strong>{x.item}</strong><div>{x.torque}</div><div className="row-meta">{x.notes}</div>{x.manual && <ManualLinks links={[x.manual]} />}</div>)}</div>}

        {vehicle === "subaru" && tab === "wiring" && <div className="garage-troubleshooting-layout"><div className="garage-troubleshooting-list">{connectorMatches.map(x => <button type="button" key={x.connector} className={"garage-troubleshooting-item " + (selectedConnectorCard?.connector === x.connector ? "active" : "")} onClick={() => setSelectedConnector(x.connector)}><span className="garage-troubleshooting-system">{x.area} · {x.color} · {x.poles} pin</span><strong>{x.connector}</strong><span>{x.connectsTo}</span></button>)}</div>{selectedConnectorCard && <div className="garage-troubleshooting-detail"><div className="kicker">Connector reference</div><h4>{selectedConnectorCard.connector} · {selectedConnectorCard.connectsTo}</h4><div className="garage-spec-list"><div className="garage-spec"><strong>Poles</strong> {selectedConnectorCard.poles}</div><div className="garage-spec"><strong>Color</strong> {selectedConnectorCard.color}</div><div className="garage-spec"><strong>Area</strong> {selectedConnectorCard.area}</div><div className="garage-spec"><strong>Use</strong> {selectedConnectorCard.use}</div></div><ManualLinks links={selectedConnectorCard.manual} /></div>}</div>}

        {vehicle === "subaru" && tab === "maintenance" && <div className="garage-spec-list">{SUBARU_CROSSTREK_MAINTENANCE.filter(x => !query || [x.item, x.interval, x.action, x.notes].join(" ").toLowerCase().includes(query.toLowerCase())).map(x => <div className="garage-spec" key={x.item}><strong>{x.item}</strong><div>{x.action} · {x.interval}</div>{x.notes && <div className="row-meta">{x.notes}</div>}<ManualLinks links={x.manual} /></div>)}</div>}

        {vehicle === "scion" && <div className="garage-guide-tabs" role="tablist" aria-label="Scion xB service knowledge"><button className={"mini-action " + (scionTab === "diagnose" ? "active" : "")} onClick={() => scionNav("diagnose")}>Diagnose</button><button className={"mini-action " + (scionTab === "dtc" ? "active" : "")} onClick={() => scionNav("dtc")}>DTC Cards · {SCION_XB_DTC_CARDS.length}</button><button className={"mini-action " + (scionTab === "service" ? "active" : "")} onClick={() => scionNav("service")}>Fluids / Service</button><button className={"mini-action " + (scionTab === "torque" ? "active" : "")} onClick={() => scionNav("torque")}>Torque</button><button className={"mini-action " + (scionTab === "wiring" ? "active" : "")} onClick={() => scionNav("wiring")}>Wiring</button><button className={"mini-action " + (scionTab === "maintenance" ? "active" : "")} onClick={() => scionNav("maintenance")}>Maintenance</button><button className={"mini-action " + (scionTab === "manual" ? "active" : "")} onClick={() => scionNav("manual")}>Manual</button></div>}
        {vehicle === "scion" && scionTab !== "manual" && <input className="command-input garage-troubleshooting-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this service library…" aria-label="Search Scion xB service library" />}
        {vehicle === "scion" && scionTab === "dtc" && <div className="garage-troubleshooting-layout"><div className="garage-troubleshooting-list">{scionDtcMatches.map(x => <button type="button" key={x.code} className={"garage-troubleshooting-item " + (selectedScionDtcCard?.code === x.code ? "active" : "")} onClick={() => setSelectedScionDtc(x.code)}><span className="garage-troubleshooting-system">{x.severity}</span><strong>{x.code}</strong><span>{x.title}</span></button>)}</div>{selectedScionDtcCard && <div className="garage-troubleshooting-detail"><div className="kicker">DTC · {selectedScionDtcCard.severity}</div><h4>{selectedScionDtcCard.code} — {selectedScionDtcCard.title}</h4><div className="garage-chip-list"><span className="garage-chip">Driveability: {selectedScionDtcCard.driveability}</span><span className="garage-chip">Diagnose before replacement</span></div><div className="garage-troubleshooting-grid"><div className="garage-troubleshooting-block"><div className="field-label">First checks</div><ol>{selectedScionDtcCard.firstChecks.map((x, i) => <li key={i}>{x}</li>)}</ol></div><div className="garage-troubleshooting-block"><div className="field-label">Likely causes</div><ol>{selectedScionDtcCard.likelyCauses.map((x, i) => <li key={i}>{x}</li>)}</ol></div></div>{selectedScionDtcCard.wiring.length > 0 && <div className="garage-troubleshooting-block"><div className="field-label">Wiring / connector evidence</div><div className="garage-spec-list">{selectedScionDtcCard.wiring.map((x, i) => <div className="garage-spec" key={i}>{x}</div>)}</div></div>}<div className="garage-troubleshooting-block"><div className="field-label">Critical specifications</div><div className="garage-spec-list">{selectedScionDtcCard.specs.map((x, i) => <div className="garage-spec" key={i}>{x}</div>)}</div></div><div className="garage-troubleshooting-block"><div className="field-label">Factory manual sections</div><ManualLinks links={selectedScionDtcCard.manual} /></div></div>}</div>}
        {vehicle === "scion" && scionTab === "service" && <div className="garage-spec-list">{SCION_XB_SERVICE_CARDS.filter(x => !query || [x.system, x.fluid, x.service, x.interval, ...x.specs].join(" ").toLowerCase().includes(query.toLowerCase())).map(x => <div className="garage-spec" key={x.system}><strong>{x.system}</strong><div>{x.fluid}</div><div>{x.service}</div><div className="row-meta">{x.interval}</div><div className="row-meta">{x.specs.join(" · ")}</div><ManualLinks links={x.manual} /></div>)}</div>}
        {vehicle === "scion" && scionTab === "torque" && <div className="garage-spec-list">{SCION_XB_TORQUE_CARDS.filter(x => !query || [x.item, x.torque, x.notes].join(" ").toLowerCase().includes(query.toLowerCase())).map(x => <div className="garage-spec" key={x.item}><strong>{x.item}</strong><div>{x.torque}</div><div className="row-meta">{x.notes}</div><ManualLinks links={[x.manual]} /></div>)}</div>}
        {vehicle === "scion" && scionTab === "wiring" && <div className="garage-troubleshooting-layout"><div className="garage-troubleshooting-list">{scionConnectorMatches.map(x => <button type="button" key={x.connector} className={"garage-troubleshooting-item " + (selectedScionConnectorCard?.connector === x.connector ? "active" : "")} onClick={() => setSelectedScionConnector(x.connector)}><span className="garage-troubleshooting-system">{x.area} · {x.poles} pin</span><strong>{x.connector}</strong><span>{x.connectsTo}</span></button>)}</div>{selectedScionConnectorCard && <div className="garage-troubleshooting-detail"><div className="kicker">Connector reference</div><h4>{selectedScionConnectorCard.connector} · {selectedScionConnectorCard.connectsTo}</h4><div className="garage-spec-list"><div className="garage-spec"><strong>Poles</strong> {selectedScionConnectorCard.poles}</div><div className="garage-spec"><strong>Color</strong> {selectedScionConnectorCard.color}</div><div className="garage-spec"><strong>Area</strong> {selectedScionConnectorCard.area}</div><div className="garage-spec"><strong>Use</strong> {selectedScionConnectorCard.use}</div></div><ManualLinks links={selectedScionConnectorCard.manual} /></div>}</div>}
        {vehicle === "scion" && scionTab === "maintenance" && <div className="garage-spec-list">{SCION_XB_MAINTENANCE.filter(x => !query || [x.item, x.interval, x.action, x.notes].join(" ").toLowerCase().includes(query.toLowerCase())).map(x => <div className="garage-spec" key={x.item}><strong>{x.item}</strong><div>{x.action} · {x.interval}</div>{x.notes && <div className="row-meta">{x.notes}</div>}<ManualLinks links={x.manual} /></div>)}</div>}
        {vehicle === "scion" && scionTab === "manual" && <div className="garage-spec-list">{SCION_XB_MANUAL_SECTIONS.map(x => <div className="garage-spec" key={x.url}><strong>{x.label}</strong><ManualLinks links={[x]} /></div>)}</div>}
        {vehicle === "subaru" && tab === "manual" && <div className="garage-spec-list">{SUBARU_CROSSTREK_MANUAL_SECTIONS.map(x => <div className="garage-spec" key={x.url}><strong>{x.label}</strong><ManualLinks links={[x]} /></div>)}<div className="row-meta">{SUBARU_CROSSTREK_SERVICE_SOURCE_NOTE}</div></div>}

        {vehicle === "subaru" && tab === "diagnose" && <div className="garage-troubleshooting-layout"><div className="garage-troubleshooting-list" role="listbox" aria-label="Troubleshooting symptoms">{matches.map(p => <button type="button" key={p.id} className={"garage-troubleshooting-item " + (selected?.id === p.id ? "active" : "")} onClick={() => setSelectedId(p.id)}><span className="garage-troubleshooting-system">{p.system}</span><strong>{p.symptom}</strong><span>{p.likelyCauses.slice(0, 2).join(" · ")}</span></button>)}</div>{selected && <div className="garage-troubleshooting-detail"><div className="kicker">{selected.system}</div><h4>{selected.symptom}</h4><div className="garage-chip-list"><span className="garage-chip">Diagnose before replacement</span><span className="garage-chip">Subaru-specific diagnostic logic</span></div><div className="garage-troubleshooting-grid"><div className="garage-troubleshooting-block"><div className="field-label">Likely / suspected areas</div><ol>{selected.likelyCauses.map((x, i) => <li key={i}>{x}</li>)}</ol></div><div className="garage-troubleshooting-block"><div className="field-label">Factory diagnostic sequence</div><ol>{selected.sequence.map((x, i) => <li key={i}>{x}</li>)}</ol></div></div><div className="garage-troubleshooting-block"><div className="field-label">Required measurements / specifications</div><div className="garage-spec-list">{selected.measurements.map((x, i) => <div className="garage-spec" key={i}>{x}</div>)}</div></div><div className="garage-troubleshooting-block"><div className="field-label">Relevant manual sections</div><ManualLinks links={SUBARU_CROSSTREK_DIAGNOSTIC_LINKS[selected.id] ?? SUBARU_CROSSTREK_MANUAL_SECTIONS.slice(0, 2)} /></div></div>}</div>}

        {vehicle === "scion" && scionTab === "diagnose" && <div className="garage-troubleshooting-layout"><div className="garage-troubleshooting-list" role="listbox" aria-label="Troubleshooting symptoms">{matches.map(p => <button type="button" key={p.id} className={"garage-troubleshooting-item " + (selected?.id === p.id ? "active" : "")} onClick={() => setSelectedId(p.id)}><span className="garage-troubleshooting-system">{p.system}</span><strong>{p.symptom}</strong><span>{p.likelyCauses.slice(0, 2).join(" · ")}</span></button>)}</div>{selected && <div className="garage-troubleshooting-detail"><div className="kicker">{selected.system}</div><h4>{selected.symptom}</h4><div className="garage-troubleshooting-grid"><div className="garage-troubleshooting-block"><div className="field-label">Likely / suspected areas</div><ol>{selected.likelyCauses.map((x, i) => <li key={i}>{x}</li>)}</ol></div><div className="garage-troubleshooting-block"><div className="field-label">Factory diagnostic sequence</div><ol>{selected.sequence.map((x, i) => <li key={i}>{x}</li>)}</ol></div></div><div className="garage-troubleshooting-block"><div className="field-label">Required measurements / specifications</div><div className="garage-spec-list">{selected.measurements.map((x, i) => <div className="garage-spec" key={i}>{x}</div>)}</div></div><div className="garage-troubleshooting-block"><div className="field-label">Relevant manual sections</div><div className="garage-chip-list">{selected.sections.map((x, i) => <span className="garage-chip" key={i}>{x.section} · {x.ref}</span>)}</div></div></div>}</div>}
      </section>
    </div>}
  </>;
}

