import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PurchaseTerms() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <button
          onClick={() => navigate(-1 as unknown as string)}
          className="mb-8 inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          ← {t("back")}
        </button>

        <h1 className="text-3xl font-bold mb-2">Purchase Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: March 2026 | dxfai.ai</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2>1. Token Packages &amp; Pricing</h2>
            <p>By completing a purchase you acquire a non-refundable, non-transferable licence to use the stated number of design tokens ("Tokens") on the dxfai.ai platform. Tokens have no monetary value, cannot be exchanged for cash, and are not transferable to other accounts. Prices are displayed in your selected currency and are inclusive of any applicable taxes unless stated otherwise.</p>
          </section>

          <section>
            <h2>2. No Expiry</h2>
            <p>Purchased Tokens do not expire and remain available in your account indefinitely, provided your account remains active and in good standing. We reserve the right to deactivate accounts that violate our Terms of Service, in which case remaining Tokens are forfeited without compensation.</p>
          </section>

          <section>
            <h2>3. No Refunds Policy</h2>
            <p>All purchases are final and non-refundable. We do not offer refunds, credits, or exchanges for purchased Tokens except where required by applicable mandatory law. If you believe a charge was made in error, please contact support at <a href="mailto:support@dxfai.ai">support@dxfai.ai</a> within 14 days of the transaction date.</p>
          </section>

          <section>
            <h2>4. Payment Processing</h2>
            <p>Payments are processed securely by PayPal Inc. We do not store your payment card details. By completing payment you also agree to PayPal's User Agreement and Privacy Policy. In case of a dispute, PayPal's resolution process may apply.</p>
          </section>

          <section>
            <h2>5. Token Deduction &amp; Refunds for Failures</h2>
            <p>Tokens are deducted upon initiating a processing job (image conversion, AI generation, or AI refinement). If a job fails due to a verified server-side error on our part, the Token is automatically refunded to your account within 24 hours. Tokens are <strong>not</strong> refunded for: (a) user-initiated cancellations after processing has begun; (b) results that do not meet subjective expectations; (c) incorrect image uploads.</p>
          </section>

          <section>
            <h2>6. Intellectual Property</h2>
            <p>You retain ownership of images you upload. Output files (DXF, PDF) generated from your images are licensed to you for personal and commercial use. We retain no rights to your output files.</p>
          </section>

          <section>
            <h2>7. Price Changes</h2>
            <p>We reserve the right to change Token prices at any time without prior notice. Price changes do not affect Tokens already purchased.</p>
          </section>

          <section>
            <h2>8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, our total liability for any claim related to a Token purchase shall not exceed the amount paid for that purchase. We are not liable for indirect, incidental, or consequential damages.</p>
          </section>

          <section>
            <h2>9. Governing Law</h2>
            <p>These Purchase Terms are governed by the laws of the State of Israel. Any disputes shall be submitted to the exclusive jurisdiction of the courts of Tel Aviv, Israel.</p>
          </section>

          <section>
            <h2>10. Contact</h2>
            <p>For purchase-related queries: <a href="mailto:support@dxfai.ai">support@dxfai.ai</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
