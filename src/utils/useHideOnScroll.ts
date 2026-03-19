import { useState, useEffect } from 'react'

export function useHideOnScroll() {
    const [isHidden, setIsHidden] = useState(false)

    useEffect(() => {
        let lastScrollY = window.scrollY
        let ticking = false

        const updateScrollDir = () => {
            const scrollY = window.scrollY

            if (Math.abs(scrollY - lastScrollY) < 10) {
                ticking = false
                return
            }

            setIsHidden(scrollY > lastScrollY && scrollY > 50)
            lastScrollY = scrollY > 0 ? scrollY : 0
            ticking = false
        }

        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScrollDir)
                ticking = true
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true })

        return () => {
            window.removeEventListener('scroll', onScroll)
        }
    }, [])

    return isHidden
}
