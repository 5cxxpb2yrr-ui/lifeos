export const SCION_XB_MANUAL_URL="https://lemon-manuals.la/Scion/2006/xB%20L4-1.5L%20%281NZ-FE%29/";

export const SCION_XB_MANUAL_LINKS={
  manual:{label:"2006 Scion xB factory service manual",url:SCION_XB_MANUAL_URL,note:"Canonical Lemon Manuals source for the 2006 Scion xB L4 1.5L (1NZ-FE)."},
  dtc:{label:"SFI / DTC reference",url:SCION_XB_MANUAL_URL,note:"Use the canonical manual source and navigate to the applicable SFI / DTC procedure."},
  powertrain:{label:"Engine control / powertrain reference",url:SCION_XB_MANUAL_URL,note:"Use the canonical manual source and navigate to the applicable powertrain procedure."},
  wiring:{label:"Engine control / wiring reference",url:SCION_XB_MANUAL_URL,note:"Use the canonical manual source and navigate to the applicable wiring or connector procedure."},
  maintenance:{label:"Maintenance reference",url:SCION_XB_MANUAL_URL,note:"Use the canonical manual source and navigate to the applicable maintenance procedure."},
  readiness:{label:"Readiness / drive-cycle reference",url:SCION_XB_MANUAL_URL,note:"Use the canonical manual source and navigate to the applicable readiness procedure."},
  ecm:{label:"ECM / wiring diagnostics",url:SCION_XB_MANUAL_URL,note:"Use the canonical manual source and navigate to the applicable ECM procedure."}
} as const;
