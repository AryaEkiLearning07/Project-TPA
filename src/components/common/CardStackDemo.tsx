import { useState } from 'react'
import CardStack from './CardStack'
import './CardStackDemo.css'

type DemoCard = {
  color: string
  id: string
  label: string
  note: string
}

const demoCards: DemoCard[] = [
  {
    color: 'linear-gradient(135deg, #f97316 0%, #fb7185 100%)',
    id: 'orange',
    label: 'Orange',
    note: 'Drag the stack left or right.',
  },
  {
    color: 'linear-gradient(135deg, #facc15 0%, #fb7185 100%)',
    id: 'yellow',
    label: 'Yellow',
    note: 'Top card swings out before it snaps.',
  },
  {
    color: 'linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)',
    id: 'green',
    label: 'Green',
    note: 'Scale and rotation follow the Swift source.',
  },
  {
    color: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
    id: 'blue',
    label: 'Blue',
    note: 'This mirrors the iMessage-style card deck.',
  },
  {
    color: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    id: 'purple',
    label: 'Purple',
    note: 'Tap a card to test selection support.',
  },
]

const CardStackDemo = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [tappedIndex, setTappedIndex] = useState<number | null>(null)

  return (
    <main className="card-stack-demo">
      <section className="card-stack-demo__hero">
        <p className="card-stack-demo__eyebrow">React Port</p>
        <h1>CardStack recreation from the SwiftUI repo</h1>
        <p className="card-stack-demo__copy">
          The motion model matches the source logic: z-order, horizontal offset,
          swing-out, scale, rotation, and spring snap.
        </p>
      </section>

      <section className="card-stack-demo__stage">
        <CardStack
          height={420}
          items={demoCards}
          onIndexChange={setCurrentIndex}
          renderCard={(card) => (
            <article
              className="card-stack-demo__card"
              onClick={() => setTappedIndex(currentIndex)}
              style={{ background: card.color }}
            >
              <span className="card-stack-demo__pill">CardStack</span>
              <div className="card-stack-demo__card-copy">
                <h2>{card.label}</h2>
                <p>{card.note}</p>
              </div>
            </article>
          )}
        />

        <div className="card-stack-demo__status">
          <p>Current card index: {currentIndex}</p>
          <p>
            {tappedIndex === null
              ? 'No card tapped yet.'
              : `Card ${tappedIndex} was tapped.`}
          </p>
        </div>
      </section>
    </main>
  )
}

export default CardStackDemo
