export type SubaruAssistantSeverity="GREEN"|"YELLOW"|"ORANGE"|"RED"|"BLUE"|"PURPLE";
export type SubaruAssistantCardType="diagnostic"|"obd_code"|"torque"|"specification"|"expert_rule"|"driveability"|"maintenance"|"repair_log";

export interface SubaruAssistantCard {
  id:string;
  type:SubaruAssistantCardType;
  title:string;
  severity?:SubaruAssistantSeverity;
  icon?:string;
  quickAnswer?:string;
  description?:string;
  workflow?:string[];
  actionSteps?:string[];
  commonCauses?:string[];
  specifications?:Record<string,string>;
  relatedDiagnostics?:string[];
  notes?:string[];
  actions?:string[];
  manual?:{label:string;url:string}[];
  category?:string;
  canDrive?:string;
  message?:string;
  reasons?:string[];
  interval?:string;
  lastService?:number;
  date?:string;
  mileage?:number;
  service?:string;
}

const manual=(label:string,url:string)=>({label,url});

const MANUAL="https://www.sucross.com/subaru_crosstrek_service_manual-728.html";
const ENGINE="https://www.sucross.com/engine_diagnostics_h4do_-1771.html";
const MAINT="https://www.sucross.com/schedule_maintenance_schedule-3417.html";
const WIRING="https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html";
const CVTF="https://www.sucross.com/adjustment-1306.html";
const P0300="https://www.sucross.com/dtc_p0300_random_multiple_cylinder_misfire_detected-1847.html";
const P0011="https://www.sucross.com/dtc_p0011_a_camshaft_position_timing_over_advanced_or_system_performance_bank_1-1789.html";
const P0420="https://www.sucross.com/dtc_p0420_catalyst_system_efficiency_below_threshold_bank_1-1868.html";
const P0456="https://www.sucross.com/dtc_p0456_evap_system_cpc_leak_detected_very_small_leak_-1874.html";

export const SUBARU_ASSISTANT_DIAGNOSTICS:SubaruAssistantCard[]=[
 {id:"no-crank",type:"diagnostic",title:"No Crank",severity:"ORANGE",icon:"battery",quickAnswer:"Battery, starter relay, or starter.",workflow:["Check battery voltage","Inspect terminals","Check starter relay","Check starter power","Test starter"],actionSteps:["Open Wiring","Start Checklist","Save Notes"],commonCauses:["Weak battery","Corroded terminals","Relay failure","Starter failure"],specifications:{minimumVoltage:"12.4V"},relatedDiagnostics:["Battery / low voltage","Starter circuit","P0562"],notes:["Use the vehicle-specific starting-system procedure before replacing the starter."],manual:[manual("Crosstrek service manual",MANUAL)]},
 {id:"crank-no-start",type:"diagnostic",title:"Crank / No Start",severity:"ORANGE",icon:"engine",quickAnswer:"Fuel, spark, air, timing, or immobilizer path.",workflow:["Confirm battery voltage","Check scan data / DTCs","Verify spark","Verify fuel delivery","Verify crank/cam synchronization"],actionSteps:["Open Wiring","Start Checklist","Save Notes"],commonCauses:["Fuel delivery issue","Ignition issue","Crank/cam signal issue","Air/fuel issue"],relatedDiagnostics:["P0300","P000A","P0011"],manual:[manual("Engine diagnostics",ENGINE)]},
 {id:"battery-drain",type:"diagnostic",title:"Battery Drain",severity:"YELLOW",icon:"battery",quickAnswer:"Find the key-off current draw before replacing the battery.",workflow:["Fully charge battery","Verify key-off state","Measure parasitic draw","Pull circuits systematically","Verify repair"],actionSteps:["Open Wiring","Start Checklist","Save Notes"],commonCauses:["Accessory draw","Module not sleeping","Interior/cargo light","Weak battery"],specifications:{testState:"Vehicle fully asleep before final draw measurement"},relatedDiagnostics:["P0562","No crank"]},
 {id:"overheat",type:"diagnostic",title:"Overheating",severity:"RED",icon:"thermometer",quickAnswer:"STOP and verify coolant, fans, thermostat, and circulation.",workflow:["Stop vehicle safely","Check coolant after cool-down","Inspect leaks","Verify fan operation","Test thermostat / circulation"],actionSteps:["Open Maintenance","Start Checklist","Save Notes"],commonCauses:["Low coolant","Cooling fan fault","Thermostat issue","Cooling-system leak"],relatedDiagnostics:["Cooling system","Engine coolant"],message:"STOP DRIVING if temperature remains elevated.",reasons:["Engine damage risk","Head-gasket damage risk"],manual:[manual("Maintenance schedule",MAINT)]},
 {id:"misfire",type:"diagnostic",title:"Active Misfire",severity:"RED",icon:"engine",quickAnswer:"Verify plugs, coils, injectors, compression, and timing before extended driving.",workflow:["Identify affected cylinder","Inspect plug and coil","Check injector operation","Check compression","Verify timing / cam control"],actionSteps:["Open DTC Cards","Start Checklist","Save Notes"],commonCauses:["Spark plug","Ignition coil","Injector","Compression / timing"],relatedDiagnostics:["P0300-P0304","P0011"],notes:["A flashing MIL or severe active misfire warrants stopping rather than continuing to drive."],manual:[manual("P0300 diagnostic procedure",P0300)]}
];

export const SUBARU_ASSISTANT_OBD:SubaruAssistantCard[]=[
 {id:"p0171",type:"obd_code",title:"P0171 — System Too Lean",severity:"ORANGE",quickAnswer:"Check for unmetered air, MAF issues, fuel pressure, and injector delivery.",description:"System Too Lean",canDrive:"Limited",commonCauses:["Vacuum leak","Dirty / inaccurate MAF","Fuel pressure issue","Injector delivery issue"],actionSteps:["Inspect intake tract","Inspect / clean MAF as applicable","Check fuel trims","Verify fuel pressure","Evaluate injectors"],workflow:["MAF","Vacuum Leak","Fuel Pressure","Injectors"],relatedDiagnostics:["Crank / no start","Misfire"],manual:[manual("Engine diagnostics",ENGINE)]},
 {id:"p0300",type:"obd_code",title:"P0300 — Random / Multiple Misfire",severity:"RED",quickAnswer:"Check plugs, coils, fuel delivery, compression, and timing.",description:"Random / Multiple Cylinder Misfire Detected",canDrive:"Stop if MIL is flashing or engine is running severely",commonCauses:["Spark plugs","Ignition coils","Fuel injectors","Compression / timing"],actionSteps:["Identify cylinder contribution","Inspect plugs / coils","Check injector operation","Check compression","Check cam timing / AVCS"],workflow:["Plugs","Coils","Compression","Fuel","Timing"],relatedDiagnostics:["Active Misfire","P0011","P000A"],manual:[manual("P0300 procedure",P0300)]},
 {id:"p0011",type:"obd_code",title:"P0011 — AVCS / Cam Timing",severity:"RED",quickAnswer:"Check oil first, then oil-control and cam-position data before condemning timing hardware.",description:"A Camshaft Position Timing Over-Advanced / System Performance",canDrive:"Limited / stop if stall or severe running condition occurs",commonCauses:["Oil level / condition","AVCS oil-control solenoid","Cam sensor / wiring","Timing hardware"],actionSteps:["Verify oil level","Verify oil viscosity / condition","Inspect AVCS control","Check cam data","Follow factory timing procedure"],workflow:["Oil","AVCS","Cam Sensors","Timing"],relatedDiagnostics:["P000A","P0014"],manual:[manual("P0011 procedure",P0011)]},
 {id:"p0456",type:"obd_code",title:"P0456 — Very Small EVAP Leak",severity:"YELLOW",quickAnswer:"Check gas cap and EVAP connections before replacing components.",description:"EVAP System Very Small Leak",canDrive:"Generally driveable",commonCauses:["Gas cap / seal","EVAP hose","Purge / vent component","Small vapor leak"],actionSteps:["Inspect gas cap","Inspect EVAP hoses","Check purge / vent circuit","Run factory EVAP test"],workflow:["Gas Cap","Hoses","Purge / Vent","Leak Test"],relatedDiagnostics:["P0442","P0455"],manual:[manual("P0456 procedure",P0456)]},
 {id:"p0420",type:"obd_code",title:"P0420 — Catalyst Efficiency",severity:"ORANGE",quickAnswer:"Verify misfires and fuel trims before replacing the catalyst.",description:"Catalyst System Efficiency Below Threshold",canDrive:"Limited; diagnose promptly",commonCauses:["Previous / active misfire","Fuel-trim issue","Exhaust leak","Catalyst degradation"],actionSteps:["Check misfire history","Check fuel trims","Inspect exhaust for leaks","Evaluate O2 data","Then assess catalyst"],workflow:["Misfires","Fuel Trims","Exhaust Leak","O2 Data","Catalyst"],relatedDiagnostics:["P0300-P0304","P0171"],manual:[manual("P0420 procedure",P0420)]}
];

export const SUBARU_ASSISTANT_TORQUE:SubaruAssistantCard[]=[
 {id:"front-brake",type:"torque",title:"Front Brake Service",category:"Brakes",severity:"BLUE",quickAnswer:"Front brake reference values supplied for the Garage Assistant.",specifications:{Bracket:"59 ft-lb / 80 N·m","Slide Pins":"25.8 ft-lb / 35 N·m"},actionSteps:["Verify VIN/application","Clean mating surfaces","Torque in the factory sequence","Mark complete"],relatedDiagnostics:["Brake noise","Brake inspection"],notes:["Verify against the applicable Subaru manual before final torque."],manual:[manual("Crosstrek service manual",MANUAL)]},
 {id:"wheel-lugs",type:"torque",title:"Wheel Lug Nuts",category:"Wheels",severity:"BLUE",quickAnswer:"89 ft-lb / 120 N·m supplied profile value.",specifications:{LugNuts:"89 ft-lb / 120 N·m"},actionSteps:["Seat wheel fully","Hand-start nuts","Torque in star pattern","Recheck after service"],relatedDiagnostics:["Wheel bearing","Tire rotation"],notes:["Verify current vehicle-specific specification."]},
 {id:"cvt-filler",type:"torque",title:"CVT Filler Plug",category:"CVT",severity:"BLUE",quickAnswer:"50 N·m / 36.9 ft-lb.",specifications:{Torque:"50 N·m / 36.9 ft-lb",LevelTemperature:"35–45°C / 95–113°F"},actionSteps:["Bring CVTF to specified temperature","Keep engine idling","Follow level procedure","Install new gasket as specified"],relatedDiagnostics:["P0841","P2763"],manual:[manual("CVTF adjustment",CVTF)]}
];

export const SUBARU_ASSISTANT_SPECS:SubaruAssistantCard[]=[
 {id:"engine-oil",type:"specification",title:"Engine Oil",severity:"BLUE",quickAnswer:"0W-20 full synthetic; supplied profile capacity 4.4 qt / 4.2 L.",specifications:{Oil:"0W-20 full synthetic","Capacity":"4.4 qt / 4.2 L",DrainPlug:"30.8 ft-lb / 41.7 N·m"},actionSteps:["Confirm VIN/application","Verify oil level","Record service"],relatedDiagnostics:["P0011","P000A"],manual:[manual("Maintenance schedule",MAINT)]},
 {id:"cvt-fluid",type:"specification",title:"CVT Fluid",severity:"BLUE",quickAnswer:"SUBARU CVT Fluid Lineartronic II.",specifications:{Fluid:"SUBARU CVT Fluid Lineartronic II","LevelTemperature":"35–45°C / 95–113°F"},actionSteps:["Confirm fluid application","Bring CVTF to specified temperature","Follow factory level procedure"],relatedDiagnostics:["P0841","P2763"],manual:[manual("CVTF adjustment",CVTF)]}
];

export const SUBARU_ASSISTANT_RULES:SubaruAssistantCard[]=[
 {id:"oil-first",type:"expert_rule",title:"Oil First Rule",severity:"PURPLE",quickAnswer:"Check oil before replacing parts when AVCS / cam-timing codes are present.",relatedDiagnostics:["P000A","P0011","P0014"],actionSteps:["Verify oil level","Verify viscosity","Inspect oil condition","Check service history"],workflow:["Oil Level","Oil Condition","AVCS","Cam Timing"],notes:["Platform-specific diagnostic guidance; follow the applicable factory procedure."]},
 {id:"evap-first",type:"expert_rule",title:"Gas Cap First",severity:"PURPLE",quickAnswer:"For small EVAP leaks, inspect the cap/seal and obvious connections before component replacement.",relatedDiagnostics:["P0442","P0455","P0456"],actionSteps:["Inspect cap","Inspect seal","Inspect EVAP hoses","Then run the factory leak procedure"],workflow:["Gas Cap","Seal","Hoses","Leak Test"]},
 {id:"misfire-first",type:"expert_rule",title:"Misfire Rule",severity:"PURPLE",quickAnswer:"P0300–P0304: check plugs, coils, fuel delivery, compression, and timing before replacing expensive parts.",relatedDiagnostics:["P0300","P0301","P0302","P0303","P0304"],actionSteps:["Identify cylinder","Check plug","Check coil","Check fuel","Check compression / timing"],workflow:["Plugs","Coils","Fuel","Compression","Timing"],manual:[manual("P0300 procedure",P0300)]},
 {id:"catalyst-first",type:"expert_rule",title:"Catalyst Rule",severity:"PURPLE",quickAnswer:"P0420: verify misfires and fuel trims first.",relatedDiagnostics:["P0420","P0300","P0171"],actionSteps:["Check misfire history","Check fuel trims","Inspect exhaust leaks","Evaluate O2 data","Then assess catalyst"],manual:[manual("P0420 procedure",P0420)]},
 {id:"awd-tire-match",type:"expert_rule",title:"AWD Tire Match Rule",severity:"PURPLE",quickAnswer:"AWD complaint: verify tire match before diagnosing expensive drivetrain faults.",relatedDiagnostics:["AWD complaint"],actionSteps:["Verify tire size","Verify circumference / wear match","Verify pressure","Then scan AWD/VDC"],notes:["Do not condemn AWD hardware from a symptom alone."]},
 {id:"cvt-scan-tcm",type:"expert_rule",title:"CVT Scan TCM First",severity:"PURPLE",quickAnswer:"CVT complaint: scan the TCM before recommending transmission replacement.",relatedDiagnostics:["P0700","P0841","P2763","CVT complaint"],actionSteps:["Scan ECM","Scan TCM","Record freeze-frame","Inspect harness/connectors","Then follow underlying DTC procedure"]}
];

export const SUBARU_ASSISTANT_DRIVEABILITY:SubaruAssistantCard[]=[
 {id:"stop-misfire",type:"driveability",title:"STOP DRIVING — Active Misfire",severity:"RED",message:"STOP DRIVING",quickAnswer:"Severe or flashing-MIL misfire can risk engine and catalyst damage.",reasons:["Engine damage risk","Catalyst damage risk"],actionSteps:["Safely stop","Record DTCs","Do not continue driving until assessed"],relatedDiagnostics:["P0300-P0304"]},
 {id:"limited-p0011",type:"driveability",title:"LIMITED DRIVE — Cam Timing Fault",severity:"RED",message:"LIMITED / STOP IF SEVERE",quickAnswer:"P0011 can be associated with poor running or stalling.",reasons:["Stall risk","Timing / engine damage risk"],actionSteps:["Check oil","Scan and diagnose AVCS","Avoid extended driving if symptoms are severe"],relatedDiagnostics:["P0011","P000A","P0014"]},
 {id:"evap-drive",type:"driveability",title:"DRIVEABLE — Small EVAP Leak",severity:"YELLOW",message:"GENERALLY DRIVEABLE",quickAnswer:"P0456 is generally not an immediate drivability emergency.",reasons:["Emissions fault","Possible worsening leak"],actionSteps:["Inspect cap","Schedule diagnosis","Clear only after repair verification"],relatedDiagnostics:["P0456","P0442","P0455"]}
];

export const SUBARU_ASSISTANT_MAINTENANCE:SubaruAssistantCard[]=[
 {id:"oil-maint",type:"maintenance",title:"Engine Oil",severity:"YELLOW",quickAnswer:"Replace at the published schedule; severe conditions shorten the interval.",interval:"6 months / 6,000 miles; severe 3 months / 3,000 miles",actionSteps:["Check current mileage/date","Perform oil service","Record service"],relatedDiagnostics:["P0011","P000A"],manual:[manual("Maintenance schedule",MAINT)]},
 {id:"plugs-maint",type:"maintenance",title:"Spark Plugs",severity:"YELLOW",quickAnswer:"Published replacement interval: 60 months / 60,000 miles.",interval:"60 months / 60,000 miles",actionSteps:["Check service history","Inspect / replace as required","Record service"],relatedDiagnostics:["P0300-P0304"],manual:[manual("Maintenance schedule",MAINT)]},
 {id:"cvt-maint",type:"maintenance",title:"CVT Fluid",severity:"YELLOW",quickAnswer:"Inspect on schedule; severe-condition replacement interval is published separately.",interval:"Scheduled inspection; severe-condition replacement every 40,000 km / 24,855 miles",actionSteps:["Check service history","Inspect fluid per factory procedure","Record service"],relatedDiagnostics:["P0841","P2763"],manual:[manual("Maintenance schedule",MAINT),manual("CVTF adjustment",CVTF)]}
];

export const SUBARU_ASSISTANT_REPAIR_LOGS:SubaruAssistantCard[]=[];

export const SUBARU_ASSISTANT_CARDS=[
 ...SUBARU_ASSISTANT_DIAGNOSTICS,
 ...SUBARU_ASSISTANT_OBD,
 ...SUBARU_ASSISTANT_TORQUE,
 ...SUBARU_ASSISTANT_SPECS,
 ...SUBARU_ASSISTANT_RULES,
 ...SUBARU_ASSISTANT_DRIVEABILITY,
 ...SUBARU_ASSISTANT_MAINTENANCE,
 ...SUBARU_ASSISTANT_REPAIR_LOGS
];

export const SUBARU_ASSISTANT_SEARCH_FIELDS=(card:SubaruAssistantCard)=>[
 card.id,card.type,card.title,card.quickAnswer,card.description,card.category,card.canDrive,card.message,
 ...(card.workflow??[]),...(card.actionSteps??[]),...(card.commonCauses??[]),...(card.relatedDiagnostics??[]),
 ...(card.reasons??[]),...(card.notes??[]),...(card.actions??[]),...(card.manual??[]).map(x=>x.label),
 ...Object.entries(card.specifications??{}).flat()
].join(" ").toLowerCase();
