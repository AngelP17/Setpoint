import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { ProofBento } from "@/components/proof-bento";
import { HowItWorks } from "@/components/how-it-works";
import { Spec } from "@/components/spec";
import { GitHubCTA } from "@/components/github-cta";
import { Footer } from "@/components/footer";

export default function Page() {
  return (
    <main>
      <Nav />
      <Hero />
      <ProofBento />
      <HowItWorks />
      <Spec />
      <GitHubCTA />
      <Footer />
    </main>
  );
}
