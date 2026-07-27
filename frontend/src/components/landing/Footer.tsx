import { Link } from 'react-router-dom'
import { Car, Facebook, Instagram, Twitter, Mail, Phone } from 'lucide-react'

const linkColumns = [
  {
    title: 'Produit',
    links: [
      { label: 'Réserver une course', to: '/auth/register' },
      { label: 'Devenir chauffeur', to: '/onboard/chauffeur' },
      { label: 'Suivi en direct', to: '/map' },
    ],
  },
  {
    title: 'Entreprise',
    links: [
      { label: 'À propos', to: '#' },
      { label: 'Carrières', to: '#' },
      { label: 'Contact', to: '#' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Politique de confidentialité', to: '#' },
      { label: "Conditions d'utilisation", to: '#' },
      { label: 'Mentions légales', to: '#' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-stone-950 text-stone-400">
      <div className="max-w-6xl mx-auto px-6 py-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-white mb-4">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-warm-gradient text-white">
              <Car size={16} />
            </span>
            samaChauffeur
          </Link>
          <p className="text-sm max-w-xs mb-6">
            Le covoiturage et le transport privé, réinventés pour aller plus vite, plus loin, en toute confiance.
          </p>
          <div className="flex items-center gap-3">
            {[Facebook, Instagram, Twitter].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="grid place-items-center w-9 h-9 rounded-full bg-white/5 hover:bg-brand-500 hover:text-white transition-colors duration-200"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {linkColumns.map((col) => (
          <div key={col.title}>
            <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
            <ul className="space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="hover:text-white transition-colors duration-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="text-white font-semibold text-sm mb-4">Contact</h4>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2">
              <Mail size={14} /> contact@samachauffeur.com
            </li>
            <li className="flex items-center gap-2">
              <Phone size={14} /> +221 33 000 00 00
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {year} samaChauffeur. Tous droits réservés.</p>
          <p>Fait avec ❤ au Sénégal</p>
        </div>
      </div>
    </footer>
  )
}
