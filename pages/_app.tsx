import "../styles/globals.css"
import type { AppProps } from "next/app"
import { ChakraProvider } from "@chakra-ui/react"
import Navbar from "../components/Navbar"
import { motion } from "framer-motion"

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <ChakraProvider>
      <Navbar />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        key={router.asPath}
      >
        <Component {...pageProps} />
      </motion.div>
    </ChakraProvider>
  )
}
