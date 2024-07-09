import { Flex, Heading, VStack } from "@chakra-ui/react"
import { useRouter } from "next/router"
import { Keypair } from "@solana/web3.js"
import { useEffect, useRef, useState } from "react"
import { createQRCode } from "../../utils/createQrCode/checkIn"
import { checkTransaction } from "../../utils/checkTransaction"

const QrCodePage = () => {
  // Get the `id` parameter from the URL
  const router = useRouter()
  const { id } = router.query

  // Create a ref to the QR code element and a state variable for the reference
  const qrRef = useRef<HTMLDivElement>(null)
  const [reference, setReference] = useState(Keypair.generate().publicKey)

  // Create the QR code when the `id` parameter or `reference` changes
  useEffect(() => {
    createQRCode(qrRef, reference, id as string)
  }, [reference])

  // Periodically check the transaction status and reset the `reference` state variable once confirmed
  useEffect(() => {
    // Set an interval to check the transaction status every 1.5 seconds
    const interval = setInterval(() => {
      checkTransaction(reference, setReference)
    }, 1500)

    // Clear the interval when the component unmounts
    return () => {
      clearInterval(interval)
    }
  }, [reference])

  return (
    <VStack justifyContent="center">
      <Heading>Location {id}</Heading>
      <Flex ref={qrRef} />
    </VStack>
  )
}

export default QrCodePage
