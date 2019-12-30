// Sigma16: architecture.js

//------------------------------------------------------------------------------
// Instruction mnemonics
//------------------------------------------------------------------------------

const mnemonicRRR =
  ["add",    "sub",    "mul",     "div",
   "cmp",    "cmplt",  "cmpeq",   "cmpgt",
   "inv",    "and",    "or",      "xor",
   "nop",    "trap",   "EXP",     "RX"]

const mnemonicRX =
  ["lea",    "load",   "store",   "jump",
   "jumpc0", "jumpc1", "jumpf",   "jumpt",
   "jal",    "nop",    "nop",     "nop",
   "nop",    "nop",    "nop",     "nop"]

const mnemonicEXP =
  ["shl",    "shr",    "getctl",  "putctl",
   "rfi",    "push",   "pop",     "top",
   "nop",    "nop",    "nop",     "nop",
   "nop",    "nop",    "nop",     "nop"]

//----------------------------------------------------------------------
// Instruction set and assembly language formats
// ---------------------------------------------------------------------

// Assembly language statement formats (machine language format)

const RRR         = 0     // R1,R2,R3    (RRR)
const RR          = 1     // R1,R2       (RRR, omitting d or b field
const RX          = 2;    // R1,xyz[R2]  (RX)
const JX          = 3;    // loop[R0]    (RX omitting d field)
const RRRX        = 4;    // R1,R2,R3    (EXP)
const RRKX        = 5;    // R1,R2,3    (EXP)
const RCX         = 6;    // getcth R4,imask

const DATA        = 7;    // -42
const COMMENT     = 8;    // ; full line comment, or blank line
const NOOPERATION = 9;    // error
const NOOPERAND   = 10;    // statement has no operand

const ASMDIR      = 11;    // fcn module    (no operand)
const ASMDIRX     = 12;    // org $f000     (operand is expression)
const ASMDIRNS    = 13;   // export x,y    (operand is list of names)

// const DIRECTIVE   = 6;    // assembler directive

function showFormat (n) {
    let f = ['RRR','RR','RX','JX','DATA','COMMENT','NOOPERATION'] [n];
    let r = f ? f : 'UNKNOWN';
    return r;
}

// Give the size of generated code for an instruction format
function formatSize (fmt) {
    if (fmt==RRR || fmt==RR || fmt==DATA) {
	return 1
    } else if (fmt==RRKX | fmt==RX | fmt==JX | fmt==RCX) {
	return 2
    } else if (fmt==NOOPERAND) {
	return 1
    } else {
	return 0
    }
}

//------------------------------------------------------------------------------
// Assembly language statements
//------------------------------------------------------------------------------

// The instruction set is represented by a map from mnemonic to
// statementSpec spec

var statementSpec = new Map();

// Each statement is initialized as noOperation; this is overridden if a
// valid operation field exists (by the parseOperation function)

const noOperation = {format:NOOPERATION, opcode:[]};

statementSpec.set("module", {format:ASMDIR, opcode:[]})
statementSpec.set("import", {format:ASMDIRNS, opcode:[]})
statementSpec.set("export", {format:ASMDIRNS, opcode:[]})
statementSpec.set("org",    {format:ASMDIRX, opcode:[]})

// Data statements
statementSpec.set("data",  {format:DATA, opcode:[]});

// Opcodes (in the op field) of 0-13 denote RRR instructions
statementSpec.set("add",   {format:RRR, opcode:[0]});
statementSpec.set("sub",   {format:RRR, opcode:[1]});
statementSpec.set("mul",   {format:RRR, opcode:[2]});
statementSpec.set("div",   {format:RRR, opcode:[3]});
statementSpec.set("cmp",   {format:RR,  opcode:[4]});
statementSpec.set("cmplt", {format:RRR, opcode:[5]});
statementSpec.set("cmpeq", {format:RRR, opcode:[6]});
statementSpec.set("cmpgt", {format:RRR, opcode:[7]});
statementSpec.set("inv",   {format:RR,  opcode:[8]});
statementSpec.set("and",   {format:RRR, opcode:[9]});
statementSpec.set("or",    {format:RRR, opcode:[10]});
statementSpec.set("xor",   {format:RRR, opcode:[11]});
statementSpec.set("nop",   {format:RRR, opcode:[12]});
statementSpec.set("trap",  {format:RRR, opcode:[13]});

// If op=14, escape to EXP format
// arithmetic with control of carry, shifting, privileged instructions

// If op=15, escape to RX format.  JX is an assembly language
// statement format which omits the d field, but the machine language
// format is RX, where R0 is used for the d field.  For example, jump
// loop[R5] doesn't require d field in assembly language, but the
// machine language uses d=R0.

// Core instructions
statementSpec.set("lea",      {format:RX,  opcode:[15,0]});
statementSpec.set("load",     {format:RX,  opcode:[15,1]});
statementSpec.set("store",    {format:RX,  opcode:[15,2]});
statementSpec.set("jump",     {format:JX,  opcode:[15,3]});
statementSpec.set("jumpc0",   {format:RX,  opcode:[15,4]});
statementSpec.set("jumpc1",   {format:RX,  opcode:[15,5]});
statementSpec.set("jumpf",    {format:RX,  opcode:[15,6]});
statementSpec.set("jumpt",    {format:RX,  opcode:[15,7]});
statementSpec.set("jal",      {format:RX,  opcode:[15,8]});

// Mnemonics for jumpc0 based on signed comparisons, overflow, carry
statementSpec.set("jumple",   {format:JX,  opcode:[15,4,bit_ccg]});
statementSpec.set("jumpne",   {format:JX,  opcode:[15,4,bit_ccE]});
statementSpec.set("jumpge",   {format:JX,  opcode:[15,4,bit_ccl]});
statementSpec.set("jumpnv",   {format:JX,  opcode:[15,4,bit_ccv]});
statementSpec.set("jumpnvu",  {format:JX,  opcode:[15,4,bit_ccV]});
statementSpec.set("jumpnco",  {format:JX,  opcode:[15,4,bit_ccc]});

// Mnemonics for jumpc1 based on signed comparisons
statementSpec.set("jumplt",   {format:JX,  opcode:[15,5,bit_ccl]});
statementSpec.set("jumpeq",   {format:JX,  opcode:[15,5,bit_ccE]});
statementSpec.set("jumpgt",   {format:JX,  opcode:[15,5,bit_ccg]});
statementSpec.set("jumpv",    {format:JX,  opcode:[15,5,bit_ccv]});
statementSpec.set("jumpvu",   {format:JX,  opcode:[15,5,bit_ccV]});
statementSpec.set("jumpco",   {format:JX,  opcode:[15,5,bit_ccc]});

// Mnemonics for EXP instructions
statementSpec.set("shl",      {format:RRKX, opcode:[14,0]});
statementSpec.set("shr",      {format:RRKX, opcode:[14,1]});
statementSpec.set("putctl",   {format:RCX,  opcode:[14,2]});
statementSpec.set("getctl",   {format:RCX,  opcode:[14,3]});
statementSpec.set("rfi",      {format:NOOPERAND,  opcode:[14,4]});

// Mnemonics for assembler directives
statementSpec.set("module",  {format:ASMDIR,   opcode:[]});
statementSpec.set("import",  {format:ASMDIRNS, opcode:[]});
statementSpec.set("export",  {format:ASMDIRNS, opcode:[]});
statementSpec.set("org",     {format:ASMDIRX,    opcode:[]});

// Mnemonics for control registers

// The getctl and putctl instructions contain a field indicating which
// control register to use. This record defines the names of those
// control registers (used in the assembly language) and the numeric
// index for the control register (used in the machine language).

var ctlReg = new Map();
ctlReg.set ("status",   {ctlRegIndex:0});
ctlReg.set ("imask",    {ctlRegIndex:1});
ctlReg.set ("ireq",     {ctlRegIndex:2});
ctlReg.set ("istat",    {ctlRegIndex:3});
ctlReg.set ("ipc",      {ctlRegIndex:4});
ctlReg.set ("ivect",    {ctlRegIndex:5});
ctlReg.set ("prog",     {ctlRegIndex:6});
ctlReg.set ("progEnd",  {ctlRegIndex:7});
ctlReg.set ("data",     {ctlRegIndex:8});
ctlReg.set ("dataEnd",  {ctlRegIndex:9});

//------------------------------------------------------------------------------
// Status register bits
//------------------------------------------------------------------------------

// Define the bit index for each flag in the status register.  "Big
// endian" notation is used, where 0 indicates the most significant
// (leftmost) bit, and index 15 indicates the least significant
// (rightmost) bit.

// When the machine boots, the registers are initialized to 0.  The
// user state flag is defined so that userStateBit=0 indicates that
// the processor is in system (or supervisor) state.  The reason for
// this is that the machine should boot into a state that enables the
// operating system to initialize itself, so privileged instructions
// need to be executable.  Furthermore, interrupts are disabled when
// the machine boots, because interrupts are unsafe to execute until
// the interrupt vector has been initialized.

const userStateBit     = 0;   // 0 = system state,  1 = user state
const intEnableBit     = 1;   // 0 = disabled,      1 = enabled


// These constants provide a faster way to set or clear the flags

const clearIntEnable = maskToClearBitBE (intEnableBit);
const setSystemState = maskToClearBitBE (userStateBit);

//------------------------------------------------------------------------------
// Interrupt irequest and imask bits
//------------------------------------------------------------------------------

const timerBit         = 0;   // timer has gone off
const segFaultBit      = 1;   // access invalid virtual address
const stackFaultBit    = 2;   // invalid memory virtual address
const userTrapBit      = 3;   // user trap
const overflowBit      = 4;   // overflow occurred
const zDivBit          = 5;   // division by 0

//------------------------------------------------------------------------------
// Assembly language data definitions for control bits
//------------------------------------------------------------------------------

// A systems program can use the following canonical data definitions
// to access the control bits.  These statements can be copied and
// pasted into an assembly language program (removing, of course, the
// // on each line).

// ; Define status register control bits
// userStateBit    data   $8000
// intEnableBit    data   $4000

// ; Define interrupt control bits
// timerBit        data   $8000   ; bit 0
// segFaultBit     data   $4000   ; bit 1
// stackFaultBit   data   $2000   ; bit 2
// userTrapBit     data   $1000   ; bit 3
// overflowBit     data   $0800   ; bit 4
// zDivBit         data   $0400   ; bit 5
