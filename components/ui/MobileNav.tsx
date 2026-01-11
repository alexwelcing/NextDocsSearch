/**
 * MobileNav - Mobile-friendly navigation drawer
 *
 * Features:
 * - Slide-in drawer from left
 * - Hamburger menu trigger
 * - Safe area support for notched devices
 * - Gesture to close (swipe left)
 * - Backdrop blur overlay
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styled, { keyframes, css } from 'styled-components';
import {
  Menu,
  X,
  Home,
  BookOpen,
  MessageCircle,
  Compass,
  Gamepad2,
  Users,
  Info,
} from 'lucide-react';

// Slide in animation
const slideIn = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`;

const slideOut = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Overlay = styled.div<{ $isOpen: boolean; $isClosing: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 998;
  opacity: ${props => props.$isOpen ? 1 : 0};
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
  transition: opacity 0.3s ease;
`;

const Drawer = styled.nav<{ $isOpen: boolean; $isClosing: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  max-width: 85vw;
  background: linear-gradient(180deg, rgba(15, 15, 25, 0.98) 0%, rgba(10, 10, 18, 0.99) 100%);
  border-right: 1px solid rgba(222, 126, 162, 0.15);
  z-index: 999;
  display: flex;
  flex-direction: column;
  transform: translateX(${props => props.$isOpen ? '0' : '-100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  /* Safe area support */
  padding-top: max(20px, env(safe-area-inset-top));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-bottom: max(20px, env(safe-area-inset-bottom));
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`;

const Logo = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, #de7ea2 0%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const CloseButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin-right: 16px;

  &:hover, &:active {
    background: rgba(255, 75, 75, 0.15);
    border-color: rgba(255, 75, 75, 0.3);
    color: #ff6b6b;
  }
`;

const NavLinks = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const NavLink = styled(Link)<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  color: ${props => props.$active ? '#fff' : '#9ca3af'};
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease;
  background: ${props => props.$active
    ? 'linear-gradient(135deg, rgba(222, 126, 162, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)'
    : 'transparent'};
  border: 1px solid ${props => props.$active ? 'rgba(222, 126, 162, 0.3)' : 'transparent'};

  &:hover, &:active {
    background: rgba(222, 126, 162, 0.1);
    color: #fff;
  }

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
`;

const NavSection = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
`;

const SectionLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6b7280;
  padding: 0 16px 8px;
`;

const DrawerFooter = styled.div`
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
`;

const VersionText = styled.div`
  font-size: 0.75rem;
  color: #4b5563;
  text-align: center;
`;

// Hamburger button for triggering the drawer
const MenuButton = styled.button<{ $visible: boolean }>`
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  left: max(16px, env(safe-area-inset-left));
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(15, 15, 25, 0.9);
  border: 1px solid rgba(222, 126, 162, 0.2);
  color: #de7ea2;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 997;
  transition: all 0.3s ease;
  backdrop-filter: blur(8px);
  opacity: ${props => props.$visible ? 1 : 0};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};
  transform: ${props => props.$visible ? 'scale(1)' : 'scale(0.8)'};

  &:hover, &:active {
    background: rgba(222, 126, 162, 0.15);
    border-color: rgba(222, 126, 162, 0.4);
    transform: scale(1.05);
  }

  svg {
    width: 24px;
    height: 24px;
  }

  @media (min-width: 1024px) {
    display: none;
  }
`;

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { href: '/', label: 'Home', icon: <Home /> },
  { href: '/articles', label: 'Articles', icon: <BookOpen /> },
  { href: '/chat', label: 'Chat', icon: <MessageCircle /> },
];

const exploreNavItems: NavItem[] = [
  { href: '/?mode=3d', label: '3D Experience', icon: <Compass /> },
  { href: '/character-studio', label: 'Character Studio', icon: <Users /> },
  { href: '/story-studio', label: 'Story Studio', icon: <Gamepad2 /> },
];

const otherNavItems: NavItem[] = [
  { href: '/about', label: 'About', icon: <Info /> },
];

interface MobileNavProps {
  visible?: boolean;
}

export default function MobileNav({ visible = true }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const touchStartX = useRef(0);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    setIsClosing(false);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeDrawer = useCallback(() => {
    setIsClosing(true);
    setIsOpen(false);
    document.body.style.overflow = '';
  }, []);

  // Close on route change
  useEffect(() => {
    const handleRouteChange = () => closeDrawer();
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events, closeDrawer]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeDrawer();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeDrawer]);

  // Swipe to close gesture
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer || !isOpen) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;

      // Swipe left to close (threshold: 50px)
      if (diff > 50) {
        closeDrawer();
      }
    };

    drawer.addEventListener('touchstart', handleTouchStart, { passive: true });
    drawer.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      drawer.removeEventListener('touchstart', handleTouchStart);
      drawer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, closeDrawer]);

  const isActive = (href: string) => {
    if (href === '/') return router.pathname === '/';
    return router.pathname.startsWith(href);
  };

  return (
    <>
      <MenuButton $visible={visible && !isOpen} onClick={openDrawer} aria-label="Open menu">
        <Menu />
      </MenuButton>

      <Overlay $isOpen={isOpen} $isClosing={isClosing} onClick={closeDrawer} />

      <Drawer ref={drawerRef} $isOpen={isOpen} $isClosing={isClosing}>
        <DrawerHeader>
          <Logo>NextDocs</Logo>
          <CloseButton onClick={closeDrawer} aria-label="Close menu">
            <X />
          </CloseButton>
        </DrawerHeader>

        <NavLinks>
          {mainNavItems.map(item => (
            <NavLink
              key={item.href}
              href={item.href}
              $active={isActive(item.href)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          <NavSection>
            <SectionLabel>Explore</SectionLabel>
            {exploreNavItems.map(item => (
              <NavLink
                key={item.href}
                href={item.href}
                $active={isActive(item.href)}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </NavSection>

          <NavSection>
            <SectionLabel>More</SectionLabel>
            {otherNavItems.map(item => (
              <NavLink
                key={item.href}
                href={item.href}
                $active={isActive(item.href)}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </NavSection>
        </NavLinks>

        <DrawerFooter>
          <VersionText>NextDocsSearch v0.1</VersionText>
        </DrawerFooter>
      </Drawer>
    </>
  );
}
