import { MapPinned, ShieldCheck, Wallet, Clock, Users, BadgeCheck } from 'lucide-react'
import Reveal from '../ui/Reveal'

const features = [
  {
    icon: MapPinned,
    title: 'Géolocalisation en direct',
    text: "Suivez votre chauffeur (ou vos passagers) en temps réel sur la carte, à la seconde près, jusqu'à l'arrivée.",
    color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400',
  },
  {
    icon: ShieldCheck,
    title: 'Chauffeurs vérifiés',
    text: 'Chaque chauffeur est validé manuellement — pièce d\'identité, permis et véhicule contrôlés avant de prendre la route.',
    color: 'bg-secondary-50 dark:bg-secondary-500/10 text-secondary-600 dark:text-secondary-400',
  },
  {
    icon: Wallet,
    title: 'Paiement flexible',
    text: 'Espèces, Orange Money, Wave — choisissez ce qui vous arrange, sans frais cachés ni surprise en fin de course.',
    color: 'bg-accent-300/30 dark:bg-accent-400/10 text-accent-600 dark:text-accent-400',
  },
  {
    icon: Clock,
    title: 'Dispo à toute heure',
    text: 'Jour et nuit, un chauffeur proche de vous en quelques minutes, même dans les zones les moins desservies.',
    color: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400',
  },
  {
    icon: Users,
    title: 'Trajets partagés',
    text: 'Partagez votre course avec d\'autres passagers qui vont dans la même direction et réduisez la facture.',
    color: 'bg-secondary-50 dark:bg-secondary-500/10 text-secondary-600 dark:text-secondary-400',
  },
  {
    icon: BadgeCheck,
    title: 'Prix garanti à l\'avance',
    text: 'Le tarif est affiché avant la réservation. Ce que vous voyez est ce que vous payez, point final.',
    color: 'bg-accent-300/30 dark:bg-accent-400/10 text-accent-600 dark:text-accent-400',
  },
]

export default function Features() {
  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-6 py-20 sm:py-28">
      <Reveal className="max-w-2xl mx-auto text-center mb-14">
        <span className="inline-block rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-semibold tracking-wide uppercase px-3 py-1 mb-4">
          Pourquoi samaChauffeur
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-50 mb-4">
          Voyagez l'esprit tranquille, à chaque course
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-lg">
          Conçu pour vous simplifier la vie : des chauffeurs de confiance, des prix clairs et une expérience
          pensée pour que chaque trajet se passe sans accroc.
        </p>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 90} variant="up">
            <div className="group h-full rounded-3xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 shadow-card hover:shadow-floating hover:-translate-y-1.5 transition-all duration-300">
              <span
                className={`grid place-items-center w-16 h-16 rounded-2xl mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${f.color}`}
              >
                <f.icon size={28} />
              </span>
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50 mb-2">{f.title}</h3>
              <p className="text-[15px] leading-relaxed text-stone-500 dark:text-stone-400">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
