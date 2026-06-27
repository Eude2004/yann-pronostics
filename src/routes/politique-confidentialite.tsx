import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/politique-confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité & Conditions — YANN PRONOSTICS" },
      {
        name: "description",
        content:
          "Politique de confidentialité, conditions d'utilisation et mentions légales de YANN PRONOSTICS (Cameroun).",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const updated = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="min-h-screen px-4 py-10 sm:py-14">
      <div className="max-w-3xl mx-auto">
        <Link to="/">
          <Button variant="outline" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'accueil
          </Button>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-10 space-y-8">
          <header className="space-y-2">
            <div className="inline-flex items-center gap-2 text-primary">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs uppercase tracking-widest">Documents légaux</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl">
              Politique de confidentialité & Conditions d'utilisation
            </h1>
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : {updated} — Régie par les lois de la République du Cameroun.
            </p>
          </header>

          <Section title="1. Préambule">
            <p>
              YANN PRONOSTICS (ci-après « le Site ») est une plateforme éditoriale de pronostics
              sportifs et de contenus d'analyse opérée depuis le Cameroun. L'accès et l'usage du
              Site impliquent l'acceptation pleine, entière et sans réserve des présentes
              conditions. Si vous n'acceptez pas tout ou partie de ces conditions, vous devez
              cesser immédiatement d'utiliser le Site.
            </p>
          </Section>

          <Section title="2. Âge légal et capacité juridique">
            <p>
              En vous inscrivant, vous <strong>certifiez sur l'honneur</strong> avoir au moins
              <strong> 18 ans révolus</strong> et disposer de la capacité juridique pour
              contracter au sens des lois camerounaises. Tout compte ouvert par un mineur ou par
              une personne juridiquement incapable sera immédiatement clôturé sans préavis ni
              remboursement.
            </p>
          </Section>

          <Section title="3. Nature du service — contenu informatif">
            <p>
              Les contenus publiés (pronostics, coupons, analyses, vidéos) ont une vocation
              <strong> strictement informative et éditoriale</strong>. Ils ne constituent ni un
              conseil financier, ni une garantie de résultat, ni une incitation au jeu. Tout pari
              ou décision prise sur la base d'un contenu du Site relève de la
              <strong> seule et entière responsabilité de l'utilisateur</strong>.
            </p>
          </Section>

          <Section title="4. Politique de paiement — AUCUN REMBOURSEMENT">
            <p>
              En procédant à un paiement (par PawaPay, GeniusPay ou tout autre prestataire), vous
              reconnaissez et acceptez expressément que :
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>
                  Tous les paiements sont définitifs, fermes et NON remboursables, quelle que
                  soit la situation
                </strong>{" "}
                — y compris (mais sans s'y limiter) : insatisfaction sur le contenu, perte d'un
                pari, résultat d'un match contraire au pronostic, annulation d'un événement
                sportif, erreur de saisie du moyen de paiement, achat en double, oubli de
                connexion, problème technique chez votre opérateur mobile ou bancaire.
              </li>
              <li>
                Aucune contestation, aucun litige, aucun chargeback ne pourra donner lieu à
                restitution des sommes versées.
              </li>
              <li>
                Le déblocage du contenu acheté (vidéo, coupon premium) vaut exécution complète et
                irrévocable du service.
              </li>
            </ul>
            <p>
              Si, exceptionnellement, un débit a eu lieu sans que le contenu n'ait été délivré
              (panne avérée et imputable au Site), un crédit interne pourra être proposé à la
              discrétion exclusive de l'administrateur — sans que cela puisse être réclamé comme
              un droit.
            </p>
          </Section>

          <Section title="5. Données personnelles collectées">
            <p>Lors de l'inscription et de l'usage du Site, nous collectons :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>vos nom, adresse email et numéro WhatsApp ;</li>
              <li>les références de vos transactions (montant, date, statut, fournisseur) ;</li>
              <li>des données techniques (adresse IP, navigateur) à des fins de sécurité.</li>
            </ul>
            <p>
              Ces données sont utilisées exclusivement pour : créer et gérer votre compte,
              traiter vos paiements, vous donner accès aux contenus, vous contacter en cas de
              besoin et lutter contre la fraude. Elles ne sont jamais vendues ni cédées à des
              tiers à des fins commerciales.
            </p>
          </Section>

          <Section title="6. Hébergement, sous-traitants et transferts">
            <p>
              Les données sont stockées chez des prestataires d'infrastructure cloud
              (Lovable Cloud / Supabase) et traitées par les prestataires de paiement PawaPay et
              GeniusPay pour les seules opérations de paiement. En utilisant le Site, vous
              consentez expressément à ces traitements et transferts.
            </p>
          </Section>

          <Section title="7. Vos droits">
            <p>
              Conformément aux principes de protection des données applicables au Cameroun, vous
              disposez d'un droit d'accès, de rectification et de suppression de vos données.
              Toute demande doit être adressée via le canal WhatsApp officiel indiqué dans le
              pied de page. La suppression de votre compte n'entraîne aucun remboursement (cf.
              article 4).
            </p>
          </Section>

          <Section title="8. Sécurité et obligations de l'utilisateur">
            <p>
              Vous êtes seul responsable de la confidentialité de votre mot de passe et de toute
              activité effectuée depuis votre compte. Vous vous engagez à ne pas : revendre,
              redistribuer ou diffuser publiquement les contenus achetés ; tenter d'accéder à
              des contenus sans paiement ; utiliser le Site à des fins frauduleuses. Toute
              violation entraîne la résiliation immédiate du compte sans remboursement et peut
              donner lieu à poursuites.
            </p>
          </Section>

          <Section title="9. Limitation de responsabilité">
            <p>
              Dans les limites permises par la loi camerounaise, le Site, son éditeur et ses
              développeurs ne pourront en aucun cas être tenus responsables des pertes
              financières, manques à gagner, préjudices moraux ou indirects résultant de
              l'utilisation ou de l'impossibilité d'utiliser le Site, de la fiabilité des
              pronostics, ou d'une indisponibilité technique. L'utilisateur renonce
              expressément à toute action en responsabilité de ce chef.
            </p>
          </Section>

          <Section title="10. Propriété intellectuelle">
            <p>
              L'ensemble des contenus (textes, vidéos, logos, identité visuelle) est la propriété
              exclusive de YANN PRONOSTICS. Toute reproduction, représentation ou rediffusion,
              totale ou partielle, sans autorisation écrite préalable est strictement interdite
              et passible de poursuites.
            </p>
          </Section>

          <Section title="11. Modification des conditions">
            <p>
              Le Site se réserve le droit de modifier les présentes conditions à tout moment. La
              version applicable est celle publiée sur cette page à la date de votre action.
              L'usage continu du Site après modification vaut acceptation.
            </p>
          </Section>

          <Section title="12. Droit applicable et juridiction">
            <p>
              Les présentes conditions sont régies par le droit camerounais. Tout litige relatif
              à leur interprétation ou à leur exécution relève de la compétence exclusive des
              juridictions compétentes de la République du Cameroun, après tentative préalable
              de règlement amiable.
            </p>
          </Section>

          <div className="pt-4 border-t border-border/60 text-xs text-muted-foreground">
            En vous inscrivant sur le Site, vous reconnaissez avoir lu, compris et accepté
            l'intégralité des présentes conditions, certifiez avoir l'âge légal requis, et
            acceptez en particulier la politique de non-remboursement décrite à l'article 4.
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-gold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
