export type VehicleManualProvider = "lemon-manuals";
export type VehicleManualStorageProvider = "icloud";

export interface VehicleManualRegistryEntry {
  id:string;
  vehicleId:string;
  year:number;
  make:string;
  model:string;
  trim?:string;
  engine?:string;
  transmission?:string;
  provider:VehicleManualProvider;
  sourceUrl:string;
  storageProvider:VehicleManualStorageProvider;
  storagePath:string;
  shareUrl?:string;
  archiveFileName:string;
  archiveSha256:string;
  archiveSizeBytes:number;
  archiveEntryCount:number;
  htmlPageCount:number;
  imageAssetCount:number;
  packageFormat:"lemon-offline-html";
  documentTypes:("service_manual"|"repair_diagnosis"|"dtc"|"wiring"|"specifications"|"labor_times"|"parts")[];
  notes?:string;
}

export const ICLOUD_VEHICLE_MANUAL_ROOT="iCloud Drive/LifeOS/Vehicle Manuals";

export const VEHICLE_MANUALS:VehicleManualRegistryEntry[]=[
  {
    id:"manual-2006-scion-xb-1nz-fe",
    vehicleId:"xB",
    year:2006,
    make:"Scion",
    model:"xB",
    engine:"1.5L 4-Cyl (1NZ-FE)",
    provider:"lemon-manuals",
    sourceUrl:"https://lemon-manuals.la/Scion/2006/xB%20L4-1.5L%20%281NZ-FE%29/",
    storageProvider:"icloud",
    storagePath:`${ICLOUD_VEHICLE_MANUAL_ROOT}/2006 Scion xB/LEMON 2006 Scion xB L4-1.5L (1NZ-FE).zip`,
    archiveFileName:"LEMON 2006 Scion xB L4-1.5L (1NZ-FE).zip",
    archiveSha256:"fc51b65385692476403807977e69cd71d2a8e978ced2419b897238c860ff67a1",
    archiveSizeBytes:106041913,
    archiveEntryCount:12779,
    htmlPageCount:7266,
    imageAssetCount:5507,
    packageFormat:"lemon-offline-html",
    documentTypes:["service_manual","repair_diagnosis","dtc","wiring","specifications","labor_times","parts"],
    notes:"User-supplied offline LEMON package. Keep the ZIP in iCloud; LifeOS stores only metadata and references."
  },
  {
    id:"manual-2019-subaru-crosstrek-premium-cvt",
    vehicleId:"Crosstrek",
    year:2019,
    make:"Subaru",
    model:"Crosstrek",
    trim:"Premium",
    transmission:"Automatic CVT",
    engine:"2.0L 4-Cyl (FB20)",
    provider:"lemon-manuals",
    sourceUrl:"https://lemon-manuals.la/Subaru/2019/Crosstrek%20Premium%2C%20Automatic%20CVT%20Trans/",
    storageProvider:"icloud",
    storagePath:`${ICLOUD_VEHICLE_MANUAL_ROOT}/2019 Subaru Crosstrek/LEMON 2019 Subaru Crosstrek Premium, Automatic CVT Trans.zip`,
    archiveFileName:"LEMON 2019 Subaru Crosstrek Premium, Automatic CVT Trans.zip",
    archiveSha256:"671e41fa9a449654d37b85276cd32023b6e9b8b91aedbd8fbcbda44795ddf24e",
    archiveSizeBytes:277356417,
    archiveEntryCount:46548,
    htmlPageCount:38502,
    imageAssetCount:8039,
    packageFormat:"lemon-offline-html",
    documentTypes:["service_manual","repair_diagnosis","dtc","wiring","specifications","labor_times"],
    notes:"User-supplied offline LEMON package. LEMON notes that the selected manual is identical to Base and Limited variants except potentially Labor Times, Fluids, and Tire Fitment."
  }
];

export function vehicleManualFor(vehicleId:string):VehicleManualRegistryEntry|undefined{
  return VEHICLE_MANUALS.find(manual=>manual.vehicleId===vehicleId);
}

export function vehicleManualById(manualId:string):VehicleManualRegistryEntry|undefined{
  return VEHICLE_MANUALS.find(manual=>manual.id===manualId);
}
