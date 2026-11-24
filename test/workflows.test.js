import test from 'node:test';
import assert from 'node:assert/strict';
import {assessReservation} from '../src/domain/requests.js';
import {assessMaintenance,expiresAfterSixMonths} from '../src/domain/access.js';
import {catalog,manholes,spans} from '../src/data/mockData.js';
import {mockRequest} from '../src/services/mockApi.js';

const network={catalog,manholes,spans};
const form={operator:'Q',spans:['DS-201','DS-202'],manholes:['MH-101','MH-102'],cable:'24F',count:1,
 spliceCount:0,spliceType:'',spliceAt:'',splicePlans:{'MH-101':{type:'Fusion',count:1},'MH-102':{type:'Mechanical',count:2}},boreChoices:{'DS-202':1}};
test('Validates the assigned bore, type-specific threshold and each splice location',()=>{
 const check=assessReservation(form,network);
 assert.equal(check.ok,true);
 assert.deepEqual(check.capacity[1].projected,[44,69]);
 assert.equal(check.capacity[1].limit,70);
 assert.equal(assessReservation({...form,count:2},network).ok,false);
 assert.equal(assessReservation({...form,splicePlans:{'MH-105':{type:'Fusion',count:2}}},network).ok,false);
});
test('Reservation approval lasts six calendar months even over month end',()=>{
 assert.equal(expiresAfterSixMonths('2026-08-31T12:00:00Z'),'2027-02-28T12:00:00.000Z');
});
test('Maintenance requires an eligible manhole and detects overlapping bookings',()=>{
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Qatar'});
 const visit={operator:'Q',manholes:['MH-102'],from:today,to:today};
 assert.equal(assessMaintenance(visit,network,[]).ok,true);
 assert.equal(assessMaintenance(visit,network,[{...visit,manhole:'MH-102',status:'Open'}]).ok,false);
});
test('Rejecting one reservation releases exactly its own capacity',async()=>{
 const request=()=>mockRequest('/reservations','POST',{...form,spans:['DS-201'],boreChoices:{},count:1});
 const first=await request(),second=await request();
 assert.equal(first.status,201);assert.equal(second.status,201);
 const denied=await mockRequest('/reservations/'+first.data.id+'/actions','POST',{action:'reject',reason:'Route change'});
 assert.equal(denied.status,200);
 const inventory=await mockRequest('/network','GET');
 assert.deepEqual(inventory.data.spans[0].bores,[34,52]);
 const audit=await mockRequest('/audit','GET');
 assert.equal(audit.data[0].target,first.data.id);
});

