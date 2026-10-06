import type {GarageTroubleshootingPath} from "@/domain/data/garage-troubleshooting";

export const SUBARU_CROSSTREK_2019_PROFILE={
 year:2019,make:"Subaru",model:"Crosstrek",engine:"FB20",transmission:"CVT",
 source:"https://www.sucross.com/",
 sourceNote:"Subaru Crosstrek service-manual material was used for diagnostic sequencing and CVT procedures; vehicle-specific quick specifications also incorporate the supplied Garage Diagnostic Assistant profile."
};

export const SUBARU_CROSSTREK_QUICK_SPECS=[
 "Engine oil: 0W-20 full synthetic · 4.4 qt (4.2 L) — supplied vehicle profile",
 "Coolant: Subaru Super Coolant — supplied vehicle profile",
 "CVT fluid: Subaru CVT Fluid Lineartronic II — service-manual reference",
 "Brake fluid: DOT 3 / DOT 4 — supplied vehicle profile",
 "Tire pressure: front 33 PSI · rear 32 PSI — supplied vehicle profile",
 "Wheel lug torque: 89 ft-lb (120 N·m) — supplied vehicle profile",
 "Charging voltage: 13.5–14.8 V — supplied vehicle profile",
 "A/C refrigerant: R-134a — supplied vehicle profile",
 "CVT fluid level check: 35–45°C (95–113°F), engine idling; level at lower section of filler opening — service-manual reference",
 "CVT filler plug torque: 50 N·m (36.9 ft-lb) — service-manual reference"
];

export const SUBARU_CROSSTREK_TORQUES=[
 "Oil drain plug · 30.8 ft-lb (41.7 N·m)",
 "Spark plugs · 13–15 ft-lb (18–21 N·m)",
 "Wheel lug nuts · 89 ft-lb (120 N·m)",
 "Front caliper brackets · 59 ft-lb (80 N·m)",
 "Rear caliper brackets · 48.7 ft-lb (66 N·m)",
 "Caliper slide pins · 25.8 ft-lb (35 N·m)",
 "Front axle nut · 159 ft-lb (216 N·m)",
 "Strut-to-knuckle bolts · 81 ft-lb (110 N·m)",
 "Valve cover bolts · 5.1 ft-lb (6.9 N·m)",
 "Intake manifold · 18 ft-lb (24.4 N·m)",
 "Exhaust manifold · 18 ft-lb (25 N·m)",
 "Battery terminals · 4 ft-lb (6 N·m)",
 "CVT drain plug · 36.9 ft-lb (50 N·m)",
 "Differential fill plug · 36 ft-lb (49 N·m)"
];

export const SUBARU_CROSSTREK_TROUBLESHOOTING:GarageTroubleshootingPath[]=[
{id:"subaru-no-crank",symptom:"No crank",system:"Starting / Charging",triggers:["no crank","starter","click","won't crank","wont crank"],likelyCauses:["Low battery voltage","Battery terminal/cable issue","Starter relay/control circuit","Starter motor"],sequence:["Measure battery voltage before chasing the starter.","Inspect terminals and cable connections.","Check the starter relay/control circuit.","Verify starter voltage during the crank request.","Replace a failed component only after the circuit test confirms it."],sections:[{section:"Starting / charging diagnostics",ref:"Factory diagnostic path"}],measurements:["Battery target from supplied profile: above 12.4 V at rest.","Charging target from supplied profile: 13.5–14.8 V."],garageLinks:["Battery / charging","Fuse locations"]},
{id:"subaru-crank-no-start",symptom:"Cranks but will not start",system:"Engine / Fuel / Ignition",triggers:["cranks but won't start","cranks but wont start","no start","no combustion"],likelyCauses:["Stored DTC or freeze-frame evidence","Fuel pump/fuel delivery","Ignition/spark","Fuel pressure","Compression"],sequence:["Scan for DTCs and preserve freeze-frame data.","Verify fuel-pump operation.","Verify spark/ignition.","Verify fuel pressure using the correct model test procedure.","Perform compression testing before condemning major engine components."],sections:[{section:"Engine diagnostics",ref:"Factory diagnostic path"}],measurements:["Use the vehicle-specific fuel-pressure specification from the service procedure; do not substitute a generic pressure value."],garageLinks:["Battery / charging","Spark plugs"]},
{id:"subaru-battery-drain",symptom:"Battery drain",system:"Starting / Charging",triggers:["battery drain","dead battery","parasitic draw","battery dies"],likelyCauses:["Aged/weak battery","Charging-system fault","Parasitic electrical load","Module/circuit remaining awake"],sequence:["Check battery age and condition.","Verify charging voltage with the engine running.","Fully charge the battery before a parasitic-draw test.","Isolate the offending circuit before replacing modules."],sections:[{section:"Starting / charging diagnostics",ref:"Factory diagnostic path"}],measurements:["Charging target from supplied profile: 13.5–14.8 V."],garageLinks:["Battery / charging","Fuse locations"]},
{id:"subaru-overheat",symptom:"Engine overheating",system:"Cooling",triggers:["overheating","overheat","runs hot","temperature high"],likelyCauses:["Low coolant/leak","Cooling fan fault","Thermostat","Water pump/cooling-system fault"],sequence:["Check coolant level and visible leaks.","Verify radiator/cooling-fan operation.","Check thermostat operation.","Inspect the water pump and remaining cooling-system components.","Stop driving if temperature continues rising or a critical warning is present."],sections:[{section:"Cooling system",ref:"Factory diagnostic path"}],measurements:["Coolant: Subaru Super Coolant per supplied vehicle profile."],garageLinks:["Coolant service","Fluid capacities"]},
{id:"subaru-no-heat",symptom:"No cabin heat",system:"HVAC / Cooling",triggers:["no heat","heater cold","heater not working","cold air"],likelyCauses:["Engine not reaching operating temperature","Low coolant/air in system","Heater-core flow issue","Blend-door/control issue"],sequence:["Verify engine reaches normal operating temperature.","Check coolant level and heater-hose temperature difference.","If coolant flow is correct, inspect blend-door/control operation.","Do not replace the heater core before confirming flow and control faults."],sections:[{section:"HVAC / heater diagnostics",ref:"Factory diagnostic path"}],measurements:["Use coolant-temperature data rather than gauge position alone when available."],garageLinks:["Coolant service","HVAC"]},
{id:"subaru-no-ac",symptom:"A/C does not cool",system:"HVAC / A/C",triggers:["no ac","no a/c","warm air","not cold","compressor"],likelyCauses:["Blower/fuse/control issue","Compressor engagement/control","Condenser fan","Refrigerant charge/pressure","Pressure or evaporator sensor"],sequence:["Verify blower operation.","Verify compressor engagement/control.","Verify condenser-fan operation.","Check refrigerant pressures and charge with the correct procedure.","Check HVAC sensor/control codes before replacing the compressor."],sections:[{section:"HVAC / A/C diagnostics",ref:"Factory diagnostic path"}],measurements:["A/C refrigerant: R-134a per supplied vehicle profile."],garageLinks:["HVAC","Battery / charging"]},
{id:"subaru-brake-noise",symptom:"Brake noise",system:"Brakes",triggers:["brake noise","brake squeal","grinding","brake vibration"],likelyCauses:["Pad condition","Hardware","Rotor condition","Caliper/slide-pin condition"],sequence:["Inspect pads and remaining thickness.","Inspect anti-rattle/hardware condition.","Inspect rotor surface and runout as appropriate.","Verify caliper and slide-pin operation before replacing components."],sections:[{section:"Brake diagnostics",ref:"Factory diagnostic path"}],measurements:["Front caliper bracket torque: 59 ft-lb (80 N·m) — supplied profile.","Rear caliper bracket torque: 48.7 ft-lb (66 N·m) — supplied profile.","Caliper slide-pin torque: 25.8 ft-lb (35 N·m) — supplied profile."],garageLinks:["Brake service","Torque specifications"]},
{id:"subaru-awd",symptom:"AWD warning / AWD concern",system:"AWD / Vehicle Dynamics",triggers:["awd","awd light","awd issue","wheel mismatch","traction"],likelyCauses:["Mismatched tire size/circumference","Unequal tire wear","Incorrect tire pressure","AWD/VDC control fault"],sequence:["Verify all four tires are the correct size.","Compare tread wear/circumference.","Set tire pressures correctly.","Scan AWD/VDC/related systems before condemning drivetrain hardware."],sections:[{section:"AWD / VDC diagnostics",ref:"Factory diagnostic path"}],measurements:["Supplied profile tire pressures: front 33 PSI · rear 32 PSI."],garageLinks:["Tire pressures","Vehicle dynamics"]},
{id:"subaru-cvt",symptom:"CVT issue / shudder / abnormal transmission behavior",system:"CVT / TR580",triggers:["cvt","transmission","shudder","jerk","slip","at oil temp","cvt overheat"],likelyCauses:["DTC/control fault","CVT fluid level/condition","Valve-body/control issue","Harness/connectors","Internal CVT fault"],sequence:["Perform the factory pre-inspection: harness condition, oil leakage, relevant tests and road-test evidence.","Check the AT OIL TEMP indicator behavior and read TCM DTCs.","Inspect CVT fluid condition and level using the specified temperature procedure.","Evaluate valve-body/control operation before recommending transmission replacement.","Use drive-cycle procedures after repair when the applicable DTC procedure requires them."],sections:[{section:"CVT diagnostics",ref:"Basic Diagnostic Procedure"},{section:"CVT diagnostics",ref:"AT OIL TEMP Warning Light Display"},{section:"CVT",ref:"CVTF Adjustment"},{section:"CVT diagnostics",ref:"Drive Cycle"}],measurements:["CVTF level check: 35–45°C (95–113°F), engine idling.","Specified fluid: Subaru CVT Fluid Lineartronic II.","Filler plug torque: 50 N·m (36.9 ft-lb)."],garageLinks:["CVT service","Fluid capacities","Diagnostic scanner"]},
{id:"subaru-misfire",symptom:"Misfire",system:"Engine / Ignition",triggers:["misfire","p0300","p0301","p0302","p0303","p0304"],likelyCauses:["Oil level/condition issue","Spark plugs","Ignition coils","Fuel trim/fuel delivery","Compression"],sequence:["Check oil level and condition first.","Inspect spark plugs.","Evaluate ignition coils.","Review fuel trims and fuel pressure.","Perform compression testing before recommending major engine repair."],sections:[{section:"Engine diagnostics",ref:"Misfire triage"}],measurements:["Spark-plug torque from supplied profile: 13–15 ft-lb (18–21 N·m)."],garageLinks:["Spark plugs","Oil service","Diagnostic scanner"]},
{id:"subaru-avcs",symptom:"AVCS / cam timing fault",system:"Engine / AVCS",triggers:["p000a","p0011","p0014","avcs","cam timing"],likelyCauses:["Low/incorrect/dirty engine oil","AVCS oil-control issue","Cam sensor/control issue","Timing-component issue"],sequence:["Check oil level.","Check oil condition and maintenance history.","Confirm the specified viscosity.","Only then inspect AVCS solenoids, cam sensors and timing components."],sections:[{section:"Engine / AVCS diagnostics",ref:"Supplied Subaru-specific rule"}],measurements:["Engine oil: 0W-20 full synthetic · 4.4 qt (4.2 L) per supplied vehicle profile."],garageLinks:["Oil service","Diagnostic scanner"]},
{id:"subaru-evap",symptom:"EVAP leak code",system:"Emissions / EVAP",triggers:["p0442","p0455","p0456","evap","fuel vapor"],likelyCauses:["Fuel cap not sealed","Fuel-cap seal","EVAP hose/connection leak"],sequence:["Inspect fuel cap installation.","Inspect the cap seal.","Inspect EVAP hoses and connections.","Use smoke/leak testing if the basic inspection does not isolate the leak."],sections:[{section:"Emission / EVAP diagnostics",ref:"Supplied Subaru-specific rule"}],measurements:["Do not replace an EVAP component before confirming the leak location."],garageLinks:["Emissions diagnostics"]},
{id:"subaru-p0420",symptom:"P0420 catalyst-efficiency code",system:"Emissions / Catalyst",triggers:["p0420","catalyst","catalytic converter"],likelyCauses:["Misfire/fueling issue","Exhaust leak","Upstream O2/A/F sensor issue","Downstream O2 sensor issue","Catalyst degradation"],sequence:["Check for active/recent misfires.","Review fuel trims.","Check for exhaust leaks.","Evaluate upstream sensor operation.","Evaluate downstream sensor operation.","Recommend catalyst replacement only after these checks support catalyst failure."],sections:[{section:"Emission / catalyst diagnostics",ref:"Supplied Subaru-specific rule"}],measurements:["Validate the root cause before replacing the catalyst."],garageLinks:["Emissions diagnostics","Diagnostic scanner"]}
];

export const SUBARU_CROSSTREK_OBD_CODES=[
 ["P0128","Thermostat below regulating temperature","YELLOW"],
 ["P0171","System too lean","ORANGE"],
 ["P0300","Random misfire","RED"],
 ["P0301","Cylinder 1 misfire","RED"],
 ["P0302","Cylinder 2 misfire","RED"],
 ["P0303","Cylinder 3 misfire","RED"],
 ["P0304","Cylinder 4 misfire","RED"],
 ["P0442","Small EVAP leak","GREEN"],
 ["P0455","Large EVAP leak","GREEN"],
 ["P0456","Very small EVAP leak","GREEN"],
 ["P0101","MAF performance","YELLOW"],
 ["P0102","MAF low input","YELLOW"],
 ["P0137","Rear O2 sensor low voltage","YELLOW"],
 ["P0141","O2 heater fault","YELLOW"],
 ["P0562","Low system voltage","ORANGE"],
 ["P000A","Intake cam slow response","ORANGE"],
 ["P0011","Intake timing over-advanced","RED"],
 ["P0014","Exhaust timing over-advanced","RED"],
 ["P0700","Transmission fault flag","ORANGE"],
 ["P0841","CVT pressure sensor","ORANGE"],
 ["P2763","Torque converter control circuit","ORANGE"],
 ["C0057","Wheel speed sensor","ORANGE"],
 ["C0071","Steering angle sensor","YELLOW"]
] as const;


type SubaruDiagnosticLink={label:string;url:string;note?:string};
const subaruLink=(label:string,url:string,note?:string):SubaruDiagnosticLink=>({label,url,note});

export const SUBARU_CROSSTREK_DIAGNOSTIC_LINKS:Record<string,SubaruDiagnosticLink[]>={
 "subaru-no-crank":[subaruLink("Full Subaru Crosstrek service manual","https://www.sucross.com/subaru_crosstrek_service_manual-728.html"),subaruLink("Engine wiring / transmission cord locations","https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html")],
 "subaru-crank-no-start":[subaruLink("Engine diagnostics index","https://www.sucross.com/engine_diagnostics_h4do_-1771.html"),subaruLink("Engine wiring / transmission cord locations","https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html")],
 "subaru-battery-drain":[subaruLink("Full Subaru Crosstrek service manual","https://www.sucross.com/subaru_crosstrek_service_manual-728.html"),subaruLink("Engine wiring / transmission cord locations","https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html")],
 "subaru-overheat":[subaruLink("Full Subaru Crosstrek service manual","https://www.sucross.com/subaru_crosstrek_service_manual-728.html"),subaruLink("Maintenance schedule","https://www.sucross.com/schedule_maintenance_schedule-3417.html")],
 "subaru-no-heat":[subaruLink("Full Subaru Crosstrek service manual","https://www.sucross.com/subaru_crosstrek_service_manual-728.html"),subaruLink("Maintenance schedule","https://www.sucross.com/schedule_maintenance_schedule-3417.html")],
 "subaru-no-ac":[subaruLink("Full Subaru Crosstrek service manual","https://www.sucross.com/subaru_crosstrek_service_manual-728.html"),subaruLink("Maintenance schedule","https://www.sucross.com/schedule_maintenance_schedule-3417.html")],
 "subaru-brake-noise":[subaruLink("Full Subaru Crosstrek service manual","https://www.sucross.com/subaru_crosstrek_service_manual-728.html"),subaruLink("Maintenance schedule","https://www.sucross.com/schedule_maintenance_schedule-3417.html")],
 "subaru-awd":[subaruLink("Full Subaru Crosstrek service manual","https://www.sucross.com/subaru_crosstrek_service_manual-728.html"),subaruLink("Engine wiring / transmission cord locations","https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html")],
 "subaru-cvt":[subaruLink("CVT electrical component locations","https://www.sucross.com/electrical_component_location_location-1279.html"),subaruLink("CVTF adjustment","https://www.sucross.com/adjustment-1306.html"),subaruLink("CVTF replacement","https://www.sucross.com/replacement-1309.html"),subaruLink("CVT drive cycles","https://www.sucross.com/drive_cycle_procedure-1278.html")],
 "subaru-misfire":[subaruLink("P0300 factory diagnostic","https://www.sucross.com/dtc_p0300_random_multiple_cylinder_misfire_detected-1847.html"),subaruLink("Engine wiring / transmission cord locations","https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html"),subaruLink("Engine drive cycles","https://www.sucross.com/drive_cycle_procedure-1968.html")],
 "subaru-avcs":[subaruLink("P0011 factory diagnostic","https://www.sucross.com/dtc_p0011_a_camshaft_position_timing_over_advanced_or_system_performance_bank_1-1789.html"),subaruLink("Engine diagnostics index","https://www.sucross.com/engine_diagnostics_h4do_-1771.html"),subaruLink("Engine drive cycles","https://www.sucross.com/drive_cycle_procedure-1968.html")],
 "subaru-evap":[subaruLink("P0456 factory diagnostic","https://www.sucross.com/dtc_p0456_evap_system_cpc_leak_detected_very_small_leak_-1874.html"),subaruLink("Engine diagnostics index","https://www.sucross.com/engine_diagnostics_h4do_-1771.html"),subaruLink("Engine drive cycles","https://www.sucross.com/drive_cycle_procedure-1968.html")],
 "subaru-p0420":[subaruLink("P0420 factory diagnostic","https://www.sucross.com/dtc_p0420_catalyst_system_efficiency_below_threshold_bank_1-1868.html"),subaruLink("Engine wiring / transmission cord locations","https://www.sucross.com/engine_wiring_harness_and_transmission_cord_location-4212.html"),subaruLink("Engine drive cycles","https://www.sucross.com/drive_cycle_procedure-1968.html")]
};
