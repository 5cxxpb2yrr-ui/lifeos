import assert from "node:assert/strict";
import test from "node:test";
import {
  ICLOUD_VEHICLE_MANUAL_ROOT,
  VEHICLE_MANUALS,
  vehicleManualById,
  vehicleManualFor,
} from "../domain/data/vehicle-manuals.ts";
import {iCloudVehicleManualPath} from "../storage/attachments/icloud.ts";

test("vehicle manual registry covers the two user-supplied vehicles",()=>{
 assert.deepEqual(VEHICLE_MANUALS.map(manual=>manual.vehicleId),["xB","Crosstrek"]);
 assert.equal(vehicleManualFor("xB")?.engine,"1.5L 4-Cyl (1NZ-FE)");
 assert.equal(vehicleManualFor("Crosstrek")?.transmission,"Automatic CVT");
});

test("manual registry preserves archive provenance without storing the binaries",()=>{
 const scion=vehicleManualById("manual-2006-scion-xb-1nz-fe");
 const subaru=vehicleManualById("manual-2019-subaru-crosstrek-premium-cvt");
 assert.equal(scion?.archiveSizeBytes,106041913);
 assert.equal(scion?.archiveSha256,"fc51b65385692476403807977e69cd71d2a8e978ced2419b897238c860ff67a1");
 assert.equal(subaru?.archiveSizeBytes,277356417);
 assert.equal(subaru?.archiveSha256,"671e41fa9a449654d37b85276cd32023b6e9b8b91aedbd8fbcbda44795ddf24e");
});

test("iCloud manual paths are deterministic",()=>{
 const path=iCloudVehicleManualPath({
  year:2006,make:"Scion",model:"xB",
  archiveFileName:"LEMON 2006 Scion xB L4-1.5L (1NZ-FE).zip",
 });
 assert.equal(path,ICLOUD_VEHICLE_MANUAL_ROOT+"/2006 Scion xB/LEMON 2006 Scion xB L4-1.5L (1NZ-FE).zip");
});
