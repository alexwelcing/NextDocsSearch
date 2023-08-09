import React from 'react'
import About from '../pages/about'

interface AboutModalProps {
  isAboutModalOpen: boolean
  onClose: () => void
}

const AboutModal: React.FC<AboutModalProps> = ({ isAboutModalOpen, onClose }) => {
  if (!isAboutModalOpen) return null

  return <About />
}

export default AboutModal
