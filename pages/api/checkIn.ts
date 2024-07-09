import { NextApiRequest, NextApiResponse } from "next"
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js"
import { locationAtIndex, Location, locations } from "../../utils/locations"
import { connection, gameId, program } from "../../utils/programSetup"
import { publicKey } from "@project-serum/anchor/dist/cjs/utils"

const eventOrganizer = getEventOrganizer()

function getEventOrganizer() {
  const eventOrganizer = JSON.parse(
    process.env.EVENT_ORGANIZER ?? ""
  ) as number[]
  if (!eventOrganizer) throw new Error("EVENT_ORGANIZER not found")

  return Keypair.fromSecretKey(Uint8Array.from(eventOrganizer))
}

//main handler function for handling all the routes
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
){
  if(req.method == 'GET'){
    return get(res);
  }

  else if(req.method == 'POST'){
    return await post(req,res);
  }

  else {
    return res.status(405).json({ error: "Method not allowed" })
}
}

//function to handle the GET request for transaction request
function get(res: NextApiResponse) {
  res.status(200).json({
    label: "Scavenger Hunt!",
    icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
});
}

//function to handle the POST request for transaction request
async function post(req: NextApiRequest, res: NextApiResponse) {
  const {account} = req.body;
  const {reference, id} = req.query;

  //error if anything is missing
  if (!account || !reference || !id) {
    res.status(400).json({ error: "Missing required parameter(s)" })
    return
  }

  try{
    const transaction = await buildTransaction(
      new PublicKey(account),
      new PublicKey(reference),
      id.toString()
    );

    //found the location id -> scavenger hunt -> each location sends a transaction request
    res.status(200).json({
      transaction: transaction,
      message: `You've found location ${id}!`,
  })
  }catch(err){
    //catch any errors in sending/building transaction
    console.log(err)
    let error = err as any
    if(error.message){
      res.status(200).json({ transaction: "", message: error.message })
    }else{
      res.status(500).json({ error: "error creating transaction" })
    }
  }
}

//function to build the transaction
async function buildTransaction(
  account : PublicKey,
  reference : PublicKey,
  id : string
): Promise<string>{
  //we will create helper functions for each of the steps in this function
  const userState = await fetchUserState(account);
  const currentLocation = locationAtIndex(new Number(id).valueOf());

  if (!currentLocation) {
    throw { message: "Invalid location id" }
  }
  
  //check whether user has visited the current location before proceeding
  if (!verifyCorrectLocation(userState, currentLocation)) {
    throw { message: "You must visit each location in order!" }
  } 

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  //create a new transaction
  const transaction = new Transaction({
    feePayer: account,
    blockhash,
    lastValidBlockHeight
  });

  //if no user state initialize the user account state -> the one we saw in the anchor PDA
  if(!userState){
    transaction.add(await createInitUserInstruction(account));
  }

  //add the check-in instruction -> the instruction that tells you have reached a certain location in the scavenger hunt
  transaction.add(
    await createCheckInInstruction(account, reference, currentLocation)
  );

  transaction.partialSign(eventOrganizer);

  //serialize and return the transaction
  const serializedTransaction = transaction.serialize({
    requireAllSignatures:false
  });

  const base64 = serializedTransaction.toString('base64');
  return base64;
}

//user state interface for the Anchor PDA
interface UserState {
  user: PublicKey
  gameId: PublicKey
  lastLocation: PublicKey
}

//helper function to fetch the user state PDA using the account
async function fetchUserState(
  account : PublicKey
):Promise<UserState | null>{
  const userStatePDA = PublicKey.findProgramAddressSync([gameId.toBuffer(), account.toBuffer()],program.programId)[0];

  try{
    //fetches the current state of the user state PDA if it exists -> using the UserState that we wrote in Anchor
    return await program.account.userState.fetch(userStatePDA);
  }catch{
    return null;
  }
}

//verify whether the user is at the correct location
function verifyCorrectLocation(
  userState: UserState | null,
  currentLocation: Location
): boolean {
  if( !userState){ 
    //the user should technically be at the first index -> not initialized
    return currentLocation.index == 1;
  }

  //retrieve the last location of the user
  const lastLocation = locations.find((location) => location.key.toString() == userState.lastLocation.toString()
  );

  if (!lastLocation || currentLocation.index !== lastLocation.index + 1) {
    return false
} else {
    return true
}
}

//initialize the user PDA
async function createInitUserInstruction(
  account : PublicKey
):Promise<TransactionInstruction>{
  //creates the instruction without executing it so that we can later add it to our transaction
  const initInstruction = await program.methods.initialize(gameId)
  .accounts({user:account})
  .instruction();

  return initInstruction;
}

//function to create the check-in instruction to our Anchor program after visiting a new location
async function createCheckInInstruction(
  account: PublicKey,
  reference: PublicKey,
  location: Location
): Promise<TransactionInstruction> {
  //sending the public key of the location as well
  const checkInInstruction = await program.methods.checkIn(gameId,location.key)
  .accounts({
    user : account,
    eventOrganizer: eventOrganizer.publicKey,
  })
  .instruction()

  //Imp : we also need to pass in the reference -> which will be used by Solana Pay to find our transaction
  checkInInstruction.keys.push({
    pubkey: reference,
    isSigner:false,
    isWritable:false
  });

  return checkInInstruction;
}