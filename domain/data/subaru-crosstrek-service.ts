import {SUBARU_CROSSTREK_OBD_CODES} from "@/domain/data/subaru-crosstrek-troubleshooting";

export type SubaruManualLink={label:string;url:string;note?:string};
export type SubaruDtcCard={
 code:string;title:string;severity:"GREEN"|"YELLOW"|"ORANGE"|"RED";driveability:string;
 likelyCauses:string[];firstChecks:string[];wiring:string[];specs:string[];manual:SubaruManualLink[];related:string[];
};
export type SubaruTorqueCard={item:string;torque:string;notes?:string;manual?:SubaruManualLink};
export type SubaruFluidServiceCard={system:string;fluid:string;service:string;interval?:string;specs:string[];manual:SubaruManualLink[]};
export type SubaruConnectorCard={connector:string;poles:string;color:string;area:string;connectsTo:string;use:string;manual:SubaruManualLink[]};
export type SubaruMaintenanceCard={item:string;interval:string;action:"Replace"|"Inspect"|"Perform";notes?:string;manual:SubaruManualLink[]};

const ROOT="https://www.sucross.com/";
const MANUAL="https://www.sucross.com/subaru_crosstrek_service_manual-728.html";
const ENGINE="https://www.sucross.com/engine_diagnostics_h4do_-1771.html";
const DTC_LIST="https://www.sucross.com/list_of_diagnostic_trouble_code_dtc_list-1974.html";
const MAINT="https://www.sucross.com/schedule_maintenance_schedule-3417.html";
const WIRING="https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html";
const CVTF="https://www.sucross.com/adjustment-1306.html";
const CVTF_REPLACE="https://www.sucross.com/replacement-1309.html";
const CVT_LOCATION="https://www.sucross.com/electrical_component_location_location-1279.html";
const P0841="https://www.sucross.com/dtc_p0841_transmission_fluid_pressure_sensor_switch_a_circuit_range_performance-1226.html";
const P2763="https://www.sucross.com/dtc_p2763_torque_converter_clutch_pressure_control_solenoid_control_circuit_high-1250.html";
const P0300="https://www.sucross.com/dtc_p0300_random_multiple_cylinder_misfire_detected-1847.html";
const P0011="https://www.sucross.com/dtc_p0011_a_camshaft_position_timing_over_advanced_or_system_performance_bank_1-1789.html";
const P0420="https://www.sucross.com/dtc_p0420_catalyst_system_efficiency_below_threshold_bank_1-1868.html";
const P0456="https://www.sucross.com/dtc_p0456_evap_system_cpc_leak_detected_very_small_leak_-1874.html";
const DRIVE_ENGINE="https://www.sucross.com/drive_cycle_procedure-1968.html";
const DRIVE_CVT="https://www.sucross.com/drive_cycle_procedure-1278.html";

const link=(label:string,url:string,note?:string):SubaruManualLink=>({label,url,note});

const dtcSpecific:Record<string,SubaruManualLink>={P0841:link("P0841 factory diagnostic",P0841),P2763:link("P2763 factory diagnostic",P2763),P0300:link("P0300 factory diagnostic",P0300),P0011:link("P0011 factory diagnostic",P0011),P0420:link("P0420 factory diagnostic",P0420),P0456:link("P0456 factory diagnostic",P0456)};

const dtcDetails:Record<string,Partial<SubaruDtcCard>>={
 P0128:{driveability:"Usually driveable if temperature remains controlled; investigate if overheating or drivability symptoms appear.",firstChecks:["Verify actual coolant temperature with scan data.","Check thermostat operation before replacing it.","Check related coolant-temperature DTCs."],specs:["Engine drive-cycle A includes P0128."],manual:[link("Engine drive-cycle / P0128",DRIVE_ENGINE),link("Engine diagnostics index",ENGINE)]},
 P0171:{driveability:"Drive only as appropriate; lean operation can cause hesitation, misfire or catalyst stress.",firstChecks:["Preserve freeze-frame data.","Check intake/vacuum leaks and fuel delivery.","Review fuel trims before replacing sensors."],specs:["Factory drive-cycle guidance calls for diagnosis plus drive cycle A or B."],manual:[link("Engine drive-cycle / P0171",DRIVE_ENGINE),link("Engine diagnostics index",ENGINE)]},
 P0300:{driveability:"RED — stop hard driving. A catalyst-damaging misfire can trigger immediate fault recognition.",firstChecks:["Check ECM/injector circuit integrity.","Check injector resistance and power.","Check ignition, air intake, compression and timing-chain condition."],wiring:["ECM B134 to injector connectors E5/E16/E6/E17 are explicitly checked in the factory flow.","Injector resistance target in the factory P0300 flow: 5–20 Ω."],specs:["ECM/injector circuit checks use 10 V as a decision threshold.","Drive-cycle A/B/C procedures apply after diagnosis as specified."],manual:[dtcSpecific.P0300,link("Engine wiring reference",WIRING),link("Engine drive cycles",DRIVE_ENGINE)]},
 P0301:{driveability:"RED — cylinder-specific misfire; avoid continued heavy load until cause is identified.",firstChecks:["Use cylinder-specific misfire data.","Check plug, coil, injector and compression before condemning engine hardware."],manual:[link("Engine DTC list / P0301",DTC_LIST),link("Engine drive cycles",DRIVE_ENGINE)]},
 P0302:{driveability:"RED — cylinder-specific misfire; avoid continued heavy load until cause is identified.",firstChecks:["Use cylinder-specific misfire data.","Check plug, coil, injector and compression before condemning engine hardware."],manual:[link("Engine DTC list / P0302",DTC_LIST),link("Engine drive cycles",DRIVE_ENGINE)]},
 P0303:{driveability:"RED — cylinder-specific misfire; avoid continued heavy load until cause is identified.",firstChecks:["Use cylinder-specific misfire data.","Check plug, coil, injector and compression before condemning engine hardware."],manual:[link("Engine DTC list / P0303",DTC_LIST),link("Engine drive cycles",DRIVE_ENGINE)]},
 P0304:{driveability:"RED — cylinder-specific misfire; avoid continued heavy load until cause is identified.",firstChecks:["Use cylinder-specific misfire data.","Check plug, coil, injector and compression before condemning engine hardware."],manual:[link("Engine DTC list / P0304",DTC_LIST),link("Engine drive cycles",DRIVE_ENGINE)]},
 P0442:{driveability:"GREEN — generally driveable; emissions fault should still be diagnosed.",firstChecks:["Inspect fuel-cap installation and seal.","Inspect EVAP hoses/connections.","Use leak testing if basic inspection does not isolate the leak."],manual:[link("Engine DTC list / P0442",DTC_LIST),link("Engine diagnostics index",ENGINE)]},
 P0455:{driveability:"GREEN — generally driveable unless accompanied by other symptoms.",firstChecks:["Verify fuel-cap seal and installation.","Inspect EVAP lines and connections.","Proceed to leak testing before replacing EVAP components."],manual:[link("Engine DTC list / P0455",DTC_LIST),link("Engine diagnostics index",ENGINE)]},
 P0456:{driveability:"GREEN — very-small EVAP leak; generally driveable.",firstChecks:["Start with the fuel-cap/seal and EVAP connections.","Use the P0455 procedure when directed by the factory manual."],manual:[dtcSpecific.P0456,link("Engine diagnostics index",ENGINE)]},
 P0101:{driveability:"YELLOW — drivability may be affected; diagnose air measurement before replacing the MAF.",firstChecks:["Inspect intake tract for leaks.","Check MAF connector/harness.","Compare scan data to expected operating behavior."],manual:[link("Engine diagnostics index",ENGINE)]},
 P0102:{driveability:"YELLOW — possible poor running or reduced power.",firstChecks:["Inspect MAF power/ground and connector.","Inspect intake tract.","Verify sensor signal before replacement."],manual:[link("Engine diagnostics index",ENGINE)]},
 P0137:{driveability:"YELLOW — emissions/mixture monitoring fault.",firstChecks:["Inspect rear O2 connector/harness.","Check for exhaust leaks before replacing the sensor."],manual:[link("Engine drive cycles / P0137",DRIVE_ENGINE),link("Engine diagnostics index",ENGINE)]},
 P0141:{driveability:"YELLOW — usually driveable; emissions fault.",firstChecks:["Check rear O2 heater circuit power/ground.","Inspect connector and harness.","Use the factory DTC path before replacing the sensor."],manual:[link("Engine drive cycles / P0141",DRIVE_ENGINE),link("Engine diagnostics index",ENGINE)]},
 P0562:{driveability:"ORANGE — low system voltage can create multiple secondary faults.",firstChecks:["Test battery state of charge.","Inspect battery terminals/grounds.","Verify charging-system output before chasing unrelated codes."],specs:["Supplied vehicle profile charging target: 13.5–14.8 V."],manual:[link("Engine diagnostics index",ENGINE)]},
 P000A:{driveability:"ORANGE — cam control performance fault; investigate oil/control issues promptly.",firstChecks:["Check engine oil level and condition.","Inspect AVCS oil-control circuit.","Verify cam-control data before replacing parts."],manual:[link("Engine diagnostics index",ENGINE)]},
 P0011:{driveability:"RED — may cause stall or improper idle; diagnose before continued operation.",firstChecks:["Use current-data VVT/OCV readings.","Inspect oil-control solenoid operation.","Inspect cam sprocket/oil routing before condemning timing hardware."],wiring:["The factory procedure uses Subaru Select Monitor VVT and OCV data and an oil-control-solenoid swap test."],specs:["Factory P0011 threshold uses target-vs-actual AVCS error >10°CA under defined conditions."],manual:[dtcSpecific.P0011,link("Engine drive-cycle procedure",DRIVE_ENGINE)]},
 P0014:{driveability:"RED — cam timing fault; diagnose oil/control/timing causes before replacement.",firstChecks:["Check oil level/condition.","Check AVCS control and sensor data.","Inspect timing components only after control-side checks."],manual:[link("Engine DTC list / P0014",DTC_LIST),link("Engine diagnostics index",ENGINE)]},
 P0700:{driveability:"ORANGE — ECM is reporting a transmission-control fault flag; scan the TCM for the underlying DTC.",firstChecks:["Read transmission/TCM DTCs, not just generic ECM codes.","Check AT OIL TEMP/AWD warning behavior.","Follow the underlying TCM DTC procedure."],manual:[link("CVT diagnostic component location",CVT_LOCATION),link("CVT drive-cycle procedure",DRIVE_CVT)]},
 P0841:{driveability:"ORANGE — poor standing-start acceleration, shift-control malfunction or abrupt engine-speed increase may occur.",firstChecks:["Record freeze-frame data.","Read TCM DTCs with Subaru Select Monitor.","Check harness/connectors before control-valve replacement.","Check CVTF level/condition at the specified temperature."],wiring:["CVT transmission connectors T3/T4 are in the engine/transmission harness reference.","Secondary pressure sensor AT6 is identified in the connector-location table."],specs:["Factory input-signal checks use defined ATF temperature ranges; follow the P0841 procedure rather than a generic pressure test."],manual:[dtcSpecific.P0841,link("CVT connector/component locations",CVT_LOCATION),link("CVTF adjustment",CVTF)]},
 P2763:{driveability:"ORANGE — no lock-up and engine-stall symptoms are possible.",firstChecks:["Check TCM-to-transmission harness continuity.","Inspect transmission-internal harness for pinch/damage.","Check control-valve-body connector and circuit before replacement."],wiring:["Factory procedure checks TCM and transmission connectors and transmission-internal harness."],manual:[dtcSpecific.P2763,link("CVT connector/component locations",CVT_LOCATION),link("CVT drive cycle",DRIVE_CVT)]},
 C0057:{driveability:"ORANGE — wheel-speed data can affect ABS/VDC/AWD behavior.",firstChecks:["Inspect wheel-speed sensor and harness.","Check connector condition and wheel/tone-ring area.","Scan ABS/VDC data before replacing the sensor."],manual:[link("Crosstrek service manual",MANUAL)]},
 C0071:{driveability:"YELLOW — steering-angle data fault can affect vehicle-dynamics systems.",firstChecks:["Check steering-angle sensor data and calibration status.","Inspect related connector/harness.","Follow VDC/steering diagnostics before replacement."],manual:[link("Crosstrek service manual",MANUAL)]}
};

export const SUBARU_CROSSTREK_DTC_CARDS:SubaruDtcCard[]=SUBARU_CROSSTREK_OBD_CODES.map(([code,title,severity])=>{
 const d=dtcDetails[code]??{};
 return {
  code,title,severity,
  driveability:d.driveability??"Diagnose the underlying circuit/system before replacement.",
  likelyCauses:code.startsWith("P03")?["Ignition/spark","Fuel injector/fuel delivery","Air/fuel or intake issue","Compression/timing"]:code.startsWith("P04")?["Fuel-cap/seal","EVAP hose/connection","EVAP control component","Wiring/connector"]:code.startsWith("P27")?["TCM/transmission harness","Control valve body","CVT fluid condition/level","Solenoid/control circuit"]:["Sensor/circuit fault","Connector or wiring fault","Control-system fault","Mechanical/system condition"],
  firstChecks:d.firstChecks??["Preserve freeze-frame/DTC evidence.","Inspect the connector and harness before replacing the component.","Use the factory diagnostic sequence for the code."],
  wiring:d.wiring??[],
  specs:d.specs??[],
  manual:d.manual??[link("Crosstrek service manual",MANUAL),link("Engine DTC list",DTC_LIST)],
  related:d.related??[]
 };
});

export const SUBARU_CROSSTREK_TORQUE_CARDS:SubaruTorqueCard[]=[
 {item:"Engine oil drain plug",torque:"30.8 ft-lb (41.7 N·m)",notes:"Use the vehicle-specific service procedure."},
 {item:"Spark plugs",torque:"13–15 ft-lb (18–21 N·m)",notes:"Supplied Garage Diagnostic Assistant profile."},
 {item:"Wheel lug nuts",torque:"89 ft-lb (120 N·m)",notes:"Supplied Garage Diagnostic Assistant profile."},
 {item:"Front caliper bracket",torque:"59 ft-lb (80 N·m)",notes:"Supplied profile."},
 {item:"Rear caliper bracket",torque:"48.7 ft-lb (66 N·m)",notes:"Supplied profile."},
 {item:"Caliper slide pins",torque:"25.8 ft-lb (35 N·m)",notes:"Supplied profile."},
 {item:"Front axle nut",torque:"159 ft-lb (216 N·m)",notes:"Supplied profile."},
 {item:"Strut-to-knuckle bolts",torque:"81 ft-lb (110 N·m)",notes:"Supplied profile."},
 {item:"Valve cover bolts",torque:"5.1 ft-lb (6.9 N·m)",notes:"Supplied profile."},
 {item:"Intake manifold",torque:"18 ft-lb (24.4 N·m)",notes:"Supplied profile."},
 {item:"Exhaust manifold",torque:"18 ft-lb (25 N·m)",notes:"Supplied profile."},
 {item:"Battery terminals",torque:"4 ft-lb (6 N·m)",notes:"Supplied profile."},
 {item:"CVT drain plug",torque:"31 N·m (22.9 ft-lb)",notes:"Sucross CVTF replacement procedure; this supersedes the earlier generic 50 N·m drain-plug entry." ,manual:link("CVTF replacement",CVTF_REPLACE)},
 {item:"CVT filler plug",torque:"50 N·m (36.9 ft-lb)",notes:"New gasket; level check is temperature-controlled.",manual:link("CVTF adjustment",CVTF)},
 {item:"Differential fill plug",torque:"36 ft-lb (49 N·m)",notes:"Supplied profile."}
];

export const SUBARU_CROSSTREK_FLUID_SERVICE:SubaruFluidServiceCard[]=[
 {system:"Engine",fluid:"0W-20 full synthetic engine oil",service:"Oil and filter service",interval:"Every 6 months / 6,000 miles in the published schedule; severe-condition note calls for 3 months / 3,000 miles.",specs:["Supplied vehicle profile: 4.4 qt (4.2 L)."],manual:[link("Maintenance schedule",MAINT),link("Crosstrek service manual",MANUAL)]},
 {system:"CVT (TR580)",fluid:"Subaru CVT Fluid Lineartronic II",service:"Inspect/service CVTF",interval:"CVTF inspection at scheduled intervals; severe-condition replacement every 40,000 km (24,855 miles) in the published schedule.",specs:["Level check at 35–45°C (95–113°F), engine idling.","Shift P-R-N-D-D-N-R-P to circulate fluid before checking.","Level is at lower section of filler hole."],manual:[link("CVTF adjustment",CVTF),link("CVTF replacement",CVTF_REPLACE)]},
 {system:"Front / rear differential",fluid:"Specified Subaru differential gear oil",service:"Inspect/service differential gear oil",interval:"Inspection at scheduled intervals; severe-condition replacement every 15 months / 24,000 km (15,000 miles) in the published schedule.",specs:["CVT front differential service routes through the CVT procedure; rear differential has its own service procedure."],manual:[link("Front/rear differential service", "https://www.sucross.com/front_rear_differential_gear_oil-3381.html"),link("Differential replacement", "https://www.sucross.com/replacement-3383.html")]},
 {system:"Engine coolant",fluid:"SUBARU genuine coolant / Subaru Super Coolant",service:"Cooling-system inspection and coolant replacement",interval:"First replacement after 11 years / 220,000 km (137,500 miles), then every 6 years / 120,000 km (75,000 miles).",specs:["Use the published coolant procedure; the schedule notes Subaru genuine cooling-system conditioner when replacing coolant."],manual:[link("Maintenance schedule",MAINT),link("Crosstrek service manual",MANUAL)]},
 {system:"Brake system",fluid:"DOT 3 / DOT 4 per supplied profile; factory manual specifies SAE J1703 / FMVSS No. 116 DOT 3 for the service reference",service:"Brake-fluid service",interval:"Brake fluid replacement at 30 months / 30,000 miles and every 30 months thereafter in the published schedule; severe-condition note is 15 months / 15,000 miles for high-humidity/mountain use.",specs:["Do not substitute fluid specification without confirming the vehicle/service-manual requirement."],manual:[link("Maintenance schedule",MAINT),link("Crosstrek service manual",MANUAL)]},
 {system:"A/C",fluid:"R-134a refrigerant",service:"A/C inspection/service",interval:"A/C filter every 12 months / 12,000 miles.",specs:["Refrigerant identification from supplied profile; use the vehicle-specific A/C service procedure for charge quantities."],manual:[link("Maintenance schedule",MAINT),link("Crosstrek service manual",MANUAL)]}
];

export const SUBARU_CROSSTREK_CONNECTORS:SubaruConnectorCard[]=[
 {connector:"E2",poles:"54",color:"Black",area:"A-3",connectsTo:"B21 bulkhead wiring harness",use:"Engine-harness/bulkhead reference.",manual:[link("Engine wiring harness connector location",WIRING)]},
 {connector:"E4",poles:"2",color:"Blue",area:"B-4",connectsTo:"Purge control solenoid valve",use:"EVAP diagnostics.",manual:[link("Engine wiring harness connector location",WIRING)]},
 {connector:"E5",poles:"2",color:"Dark gray",area:"B-2",connectsTo:"Fuel injector No. 1",use:"P0300/P0301 injector circuit diagnostics.",manual:[link("Engine wiring harness connector location",WIRING),dtcSpecific.P0300]},
 {connector:"E6",poles:"2",color:"Dark gray",area:"A-2",connectsTo:"Fuel injector No. 3",use:"Cylinder 3 injector circuit.",manual:[link("Engine wiring harness connector location",WIRING)]},
 {connector:"E8",poles:"2",color:"Black",area:"B-2",connectsTo:"Engine coolant temperature sensor",use:"Coolant-temperature diagnostics.",manual:[link("Engine wiring harness connector location",WIRING)]},
 {connector:"E10",poles:"3",color:"Black",area:"B-3",connectsTo:"Crankshaft position sensor",use:"Crank/no-start and misfire timing reference.",manual:[link("Engine wiring harness connector location",WIRING)]},
 {connector:"E24",poles:"4",color:"Light gray",area:"B-1",connectsTo:"Front oxygen / A/F sensor",use:"Fuel-trim/catalyst diagnostics.",manual:[link("Engine wiring harness connector location",WIRING)]},
 {connector:"E25",poles:"4",color:"Black",area:"B-1",connectsTo:"Rear oxygen sensor",use:"P0420/rear-O2 diagnostics.",manual:[link("Engine wiring harness connector location",WIRING),dtcSpecific.P0420]},
 {connector:"E35/E36",poles:"3",color:"Light gray",area:"C-3 / B-1",connectsTo:"Intake camshaft position sensors LH/RH",use:"AVCS/cam timing diagnostics.",manual:[link("Engine wiring harness connector location",WIRING),dtcSpecific.P0011]},
 {connector:"E37/E38",poles:"2",color:"Black",area:"C-3 / B-1",connectsTo:"Intake oil-control solenoids LH/RH",use:"AVCS control diagnostics.",manual:[link("Engine wiring harness connector location",WIRING),dtcSpecific.P0011]},
 {connector:"E57",poles:"6",color:"Black",area:"A-3",connectsTo:"Electronic throttle control",use:"Throttle/air-control diagnostics.",manual:[link("Engine wiring harness connector location",WIRING)]},
 {connector:"T3",poles:"16",color:"Dark gray",area:"D-4",connectsTo:"B12 bulkhead wiring harness",use:"CVT transmission harness reference.",manual:[link("Engine/transmission harness connector location",WIRING)]},
 {connector:"T4",poles:"12",color:"Gray",area:"D-4",connectsTo:"B11 bulkhead wiring harness",use:"CVT control/solenoid circuit reference.",manual:[link("Engine/transmission harness connector location",WIRING),dtcSpecific.P2763]},
 {connector:"T7",poles:"9",color:"Black",area:"D-4",connectsTo:"Inhibitor switch",use:"CVT range/inhibitor diagnostics.",manual:[link("Engine/transmission harness connector location",WIRING)]},
 {connector:"AT1",poles:"3",color:"Black",area:"D-4",connectsTo:"Primary speed sensor",use:"CVT speed-sensor diagnostics.",manual:[link("Engine/transmission harness connector location",WIRING)]},
 {connector:"AT4",poles:"3",color:"Dark gray",area:"D-5",connectsTo:"Secondary speed sensor",use:"CVT speed-sensor diagnostics.",manual:[link("Engine/transmission harness connector location",WIRING)]},
 {connector:"AT5",poles:"3",color:"Light gray",area:"D-5",connectsTo:"Turbine speed sensor",use:"CVT speed-sensor diagnostics.",manual:[link("Engine/transmission harness connector location",WIRING)]},
 {connector:"AT6",poles:"3",color:"Black",area:"D-4",connectsTo:"Secondary pressure sensor",use:"P0841/pressure diagnostics.",manual:[link("Engine/transmission harness connector location",WIRING),dtcSpecific.P0841]}
];

const baseMaintenance:SubaruMaintenanceCard[]=[
 {item:"Engine oil",interval:"6 months / 6,000 miles",action:"Replace",notes:"Severe conditions: 3 months / 3,000 miles.",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Engine oil filter",interval:"6 months / 6,000 miles",action:"Replace",notes:"Severe conditions follow the engine-oil interval.",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Spark plugs",interval:"60 months / 60,000 miles",action:"Replace",manual:[link("Maintenance schedule",MAINT)]},
 {item:"V-belt",interval:"30 months / 30,000 miles and 60 months / 60,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Fuel line",interval:"30 months / 30,000 miles and 60 months / 60,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Air cleaner element",interval:"30 months / 30,000 miles and 60 months / 60,000 miles",action:"Replace",notes:"More often in extremely dusty conditions.",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Cooling system",interval:"30 months / 30,000 miles and 60 months / 60,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Engine coolant",interval:"First 11 years / 137,500 miles, then every 6 years / 75,000 miles",action:"Replace",manual:[link("Maintenance schedule",MAINT)]},
 {item:"CVTF",interval:"Scheduled inspection; severe-condition replacement every 24,855 miles",action:"Inspect",notes:"Published schedule uses 40,000 km / 24,855 miles for severe conditions.",manual:[link("Maintenance schedule",MAINT),link("CVTF service",CVTF)]},
 {item:"Front & rear differential gear oil",interval:"Scheduled inspection; severe-condition replacement every 15 months / 15,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Brake line",interval:"12 months / 12,000 miles, then every 24 months / 24,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Brake fluid",interval:"30 months / 30,000 miles, then every 30 months / 30,000 miles",action:"Replace",notes:"Published severe-condition note: 15 months / 15,000 miles in high humidity/mountain use.",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Disc brake pads/discs",interval:"12 months / 12,000 miles, then every 24 months / 24,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Parking brake",interval:"12 months / 12,000 miles, then every 24 months / 24,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Suspension",interval:"12 months / 12,000 miles, then every 24 months / 24,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Wheel bearings",interval:"60 months / 60,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Axle boots/joints",interval:"12 months / 12,000 miles, then every 24 months / 24,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Tire rotation",interval:"6 months / 6,000 miles",action:"Perform",manual:[link("Maintenance schedule",MAINT)]},
 {item:"Steering system",interval:"12 months / 12,000 miles, then every 24 months / 24,000 miles",action:"Inspect",manual:[link("Maintenance schedule",MAINT)]},
 {item:"A/C filter",interval:"12 months / 12,000 miles",action:"Replace",notes:"More often in extremely dusty conditions.",manual:[link("Maintenance schedule",MAINT)]}
];

export const SUBARU_CROSSTREK_MAINTENANCE=baseMaintenance;
export const SUBARU_CROSSTREK_MANUAL_SECTIONS=[
 link("Full Subaru Crosstrek service manual",MANUAL),
 link("Maintenance schedule",MAINT),
 link("Engine diagnostics index",ENGINE),
 link("Engine DTC list",DTC_LIST),
 link("Engine wiring / transmission cord locations",WIRING),
 link("CVT electrical component locations",CVT_LOCATION),
 link("CVTF adjustment",CVTF),
 link("CVTF replacement",CVTF_REPLACE),
 link("CVT drive cycles",DRIVE_CVT),
 link("Engine drive cycles",DRIVE_ENGINE)
];
export const SUBARU_CROSSTREK_DIAGNOSTIC_LINKS:Record<string,SubaruManualLink[]>={};
export const SUBARU_CROSSTREK_SERVICE_SOURCE_NOTE="Service-manual links and procedures are sourced from sucross.com. Some torque/quick-spec values remain explicitly marked as supplied Garage Diagnostic Assistant profile data. Verify VIN, market, drivetrain and the applicable Subaru Warranty & Maintenance Booklet before performing scheduled service.";
