import React, { useState } from 'react'
import Link from 'next/link'
import styles from '@/styles/CircleNav.module.css'

const CircleNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={styles.container}>
      {isOpen ? (
        <div className={styles.menu}>
          <button onClick={() => setIsOpen(false)} className={styles.closeBtn}>
            ×
          </button>
          <Link className={styles.menuLink} href="/">
            Home
          </Link>
          <Link className={styles.menuLink} href="/about">
            About
          </Link>
          <Link className={styles.menuLink} href="/viewer">
            Explore
          </Link>
        </div>
      ) : (
        <div className={isOpen ? styles.menu : styles.circle} onClick={() => setIsOpen(!isOpen)}>
          {!isOpen && <span className="material-icons-outlined">explore</span>}
        </div>
      )}
    </div>
  )
}

export default CircleNav;