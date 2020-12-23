// Sigma16: emthread.mjs
// Copyright (C) 2021 John T. O'Donnell
// email: john.t.odonnell9@gmail.com
// License: GNU GPL Version 3 or later. See Sigma16/README.md, LICENSE.txt

// This file is part of Sigma16.  Sigma16 is free software: you can
// redistribute it and/or modify it under the terms of the GNU General
// Public License as published by the Free Software Foundation, either
// version 3 of the License, or (at your option) any later version.
// Sigma16 is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.  You should have received
// a copy of the GNU General Public License along with Sigma16.  If
// not, see <https://www.gnu.org/licenses/>.

// Emulator thread

import * as shm from "./shmparams.mjs"
import * as arch from './architecture.mjs'
import * as arith from './arithmetic.mjs';
import * as st  from './state.mjs';
import * as em from "./emulator.mjs"

//-----------------------------------------------------------------------------
// Emulator state
//-----------------------------------------------------------------------------

let emt =
    {initialized: false,
     shm: null, // shared system state vector
     es: null // emulator state
    }

let emtCount = 0 // local variable for testng

//-----------------------------------------------------------------------------
// Communication protocol
//-----------------------------------------------------------------------------

self.addEventListener ("message", e => {
    if (e.data) {
        console.log (`ent code = ${e.data.code}`)
        let result = 0 // default
        let msg = {code:0 , payload: 0} // default
        switch (e.data.code) {
        case 100: // emt init: received shared system state vector
            console.log ("emt: received request init")
            emt.shm = e.data.payload
            emt.es = new em.EmulatorState (emt.shm, em.Mode_Quiet)
            em.initializeMachineState (emt.es)
            emt.initialized = true
            msg = {code: 200, payload: 0}
            self.postMessage (msg)
            break
        case 101: // emt step
            console.log (`emt: received request step`)
            doStep ()
            msg = {code: 201, payload: 0}
            self.postMessage (msg)
            break
        case 102: // emt run
            console.log (`emt: received request run`)
            result = doRun (e.data.payload)
            msg = {code: 202, payload: result}
            self.postMessage (msg)
            break
        case 103: // show
            console.log (`emt: received request show`)
            show ()
            msg = {code: 203, payload: 0}
            self.postMessage (msg)
            break
        case 104: // test 1
            console.log (`emt: received request test 1`)
            let slowResult = longComputation ()
            msg = {code: 204, payload: slowResult}
            self.postMessage (msg)
            break
        case 105: // test 2
            console.log (`emt: received request test 2`)
            let rmtestResult = regMemTest ()
            msg = {code: 205, payload: rmtestResult}
            self.postMessage (msg)
            break
        default:
            console.log (`emt: received unknown code ${e.data.code}`)
        }
        emtCount++
    }
})

//-----------------------------------------------------------------------------
// Registers
//-----------------------------------------------------------------------------

// Declare the registers - window.onload sets their values

let regFile = [];                            // register file R0,..., R15
let pc, ir, adr, dat;                        // instruction control registers
let statusreg, mask, req, istat, ipc, vect;  // interrupt control registers
let bpseg, epseg, bdseg, edseg;              // segment control registers

// Generating and accessing registers

let controlRegisters;   // array of the control registers
let register = [];      // array of all the registers: regfile and control

// The system control registers are specified in the instruction by an
// index starting from i=0..., but the actual emulator data structures
// for these registers are held in the register[] array at index
// i+ctlRegIndexOffset...  It's useful to have a single array
// containing all the registers, so the emulator can refresh them all
// together.

const ctlRegIndexOffset = 20;  // add to ctl reg no. to get register[] index
let sysCtlRegIdx = 0;          // index of first system control reg
let registerIndex = 0;         // unique index for each reg

let nRegisters = 0  // number of registers that have been defined

class genregister {
    constructor (regNumber, regName, eltName, showFcn) {
        this.regStIndex = nRegisters
        nRegisters++
        this.regNumber = regNumber
        this.regName = regName
        this.eltName = eltName // not used in emt
        this.show = showFcn
//        this.elt = document.getElementById (eltName)
//	this.elt.innerHTML = this.regStIndex
        console.log (`--- Generate reg regNum=${this.regNumber}`
                     + ` name=${this.regName} idx=${this.regStIndex}`)
    }
    get () {
//        regFetched.push (this)
        let i = shm.EmRegBlockOffset + this.regStIndex
        console.log (`----- get  ${this.regName} erbo=${shm.EmRegBlockOffset} rsi=${this.regStIndex} `)
        let x = this.regStIndex === 0 ? 0 : sysStateVec [i]
        console.log (`--- reg get ${this.regName} =`
                     + ` ${arith.wordToHex4(x)} = ${x} (idx=${i})`)
        return x
    }
    put (x) {
//        regStored.push (this)
        let i = shm.EmRegBlockOffset + this.regStIndex
        sysStateVec [i] = x
//        if (this.regIdx < 16) { // register file
//            instrEffect.push (["R", this.regNumber, x, this.regName]);
//        }
        console.log (`--- reg put ${this.regName} :=`
                     + ` ${arith.wordToHex4(x)} = ${x} (idx=${i})`)
    }
    highlight (key) {
//        let i = st.EmRegBlockOffset + this.regStIndex
//        let x = this.regStIndex === 0 ? 0 : st.sysStateVec [i]
//        let xs = highlightText (this.show(x), key)
//        console.log (`--- reg highlight ${this.regName} := ${xs} (idx=${i})`)
//        this.elt.innerHTML = xs
    }
    refresh () {
//        let i = st.EmRegBlockOffset + this.regStIndex
//        let x = this.regStIndex === 0 ? 0 : st.sysStateVec [i]
//        let xs = this.show (x)
//        console.log (`--- reg refresh ${this.regName} :=`
//                     + ` ${arith.wordToHex4(x)} = ${x} /${xs}/ (idx=${i})`)
//        this.elt.innerHTML = xs
    }
}

function initializeMachineState () {
     console.log ("emulator: initializeMachineState");
//     initializeProcessorElements ();  // so far, it's just instr decode
//     clearInstrDecode (emulatorState);

    // Build the register file; sysStateVec index = reg number
    for (let i = 0; i < 16; i++) {
        let regname = 'R' + i; // also the id for element name
        regFile[i] = new genregister (i, regname, regname, arith.wordToHex4)
        register[i] = regFile[i]
    }

    // Instruction control registers
    pc   = new genregister (0,  'pc',   'pcElt',    arith.wordToHex4);
    ir   = new genregister (0,  'ir',   'irElt',    arith.wordToHex4);
    adr  = new genregister (0,  'adr',  'adrElt',   arith.wordToHex4);
    dat  = new genregister (0,  'dat',  'datElt',   arith.wordToHex4);
    
// Interrupt control registers
    statusreg  = new genregister (0, 'statusreg', 'statusElt',  arith.wordToHex4);
    // bit 0 (lsb) :  0 = User state, 1 = System state
    // bit 1       :  0 = interrupts disabled, 1 = interrupts enabled
    // bit 2       :  0 = segmentation disabled, 1 = segmentation enabled

    mask  = new genregister (0, 'mask', 'maskElt',  arith.wordToHex4);
    req   = new genregister (0, 'req',  'reqElt',   arith.wordToHex4);
    // mask and request use the same bit positions for flags
    // bit 0 (lsb)  overflow
    // bit 1        divide by 0
    // bit 2        trap 3
    // bit 3        

    istat    = new genregister (0, 'istat',  'istatElt',  arith.wordToHex4);
    ipc      = new genregister (0, 'ipc',    'ipcElt',    arith.wordToHex4);
    vect     = new genregister (0, 'vect',   'vectElt',   arith.wordToHex4);

// Segment control registers
    bpseg = new genregister (0, 'bpseg',  'bpsegElt',  arith.wordToHex4);
    epseg = new genregister (0, 'epseg',  'epsegElt',  arith.wordToHex4);
    bdseg = new genregister (0, 'bdseg',  'bdsegElt',  arith.wordToHex4);
    edseg = new genregister (0, 'edseg',  'edsegElt',  arith.wordToHex4);

// Record the control registers    
    controlRegisters =
	[pc, ir, adr, dat,   // not accessible to getctl/putctl instructions
	 // the following can be used for getctl/getctl, indexing from 0
	 statusreg, mask, req, istat, ipc, vect,
         bpseg, epseg, bdseg, edseg
	]

//    memInitialize();
//    resetRegisters();
}



 
//-----------------------------------------------------------------------------
// Memory
//-----------------------------------------------------------------------------

function memFetchInstr (a) {
//    memFetchInstrLog.push(a);
    let x = sysStateVec [shm.EmMemOffset + a]
    return x
}

function memFetchData (a) {
//    memFetchDataLog.push(a);
    let x = sysStateVec [shm.EmMemOffset + a]
    return x
}

function memStore (a,x) {
//    memStoreLog.push(a);
//    instrEffect.push(["M", a, x]);
    sysStateVec [shm.EmMemOffset + a] = x
}


//-----------------------------------------------------------------------------
// Test
//-----------------------------------------------------------------------------

function show () {
    showRegs ()
    showMem (20)
}

function showRegs () {
    console.log (`emt showRegs`)
    for (let i = 0; i < shm.EmRegBlockSize; i++) {
        let j = shm.EmRegBlockOffset + i
        let x = sysStateVec [j]
        //        console.log (`emt reg[${i}] = ${x} (j=${j})`)
        console.log (`emt reg[${i}] = ${x}`)
    }
}

function showMem (limit) {
    console.log (`emt showMem up to ${limit}`)
    for (let a = 0; a <= limit; a++) {
        let j = shm.EmMemOffset + a
        let x = sysStateVec [j]
        console.log (`emt m[${a}] = ${x}`)
    }
}

function longComputation () {
    console.log ("emt long computation, here goes...")
    let sum = 0
    const lim1 = 1000
    const lim2 = 1000
    const lim3 = 1000
    for (let i = 0; i < lim1; i++) {
        for (let j = 0; j < lim2; j++) {
            for (let k = 0; k < lim2; k++) {
                sum += k
            }
        }
    }
    console.log ("emt long computation finished!")
    return sum
}

function regMemTest () {
    let a = pc.get ()
    console.log (`emt rmtest a = ${a}`)
    let b = ir.get ()
    console.log (`emt rmtest b = ${b}`)
    pc.put (a + 10)
    let c = pc.get ()
    console.log (`emt rmtest c = ${c}`)
    return c
    return x
}

//-----------------------------------------------------------------------------
// Interface to emulator
//-----------------------------------------------------------------------------

function doStep () {
    console.log (`emt doStep`)
    em.executeInstruction (emt.es)
    console.log (`emt doStep returning`)
}

function doRun (limit) {
    console.log (`emt: start doRun limit=${limit}`)
    let count = 0
    //    let startTime = new Date ()
    let startTime = performance.now ()
    while (st.readSCB (emt.es, st.SCB_halted) != 1
           && st.readSCB (emt.es, st.SCB_pause_request) != 1) {
        em.executeInstruction (emt.es)
        count++
      }
    //    let finishTime = new Date ()
    let finishTime = performance.now ()
    let elapsedTime = (finishTime - startTime) / 1000
    console.log (`emt: doRun finished, executed ${count} instructions`
                 + ` in ${elapsedTime} sec`)
    return count
}
//        console.log (`emt doRun count=${count}`)

console.log ("emtthread has been read")
