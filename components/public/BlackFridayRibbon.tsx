import styles from "./BlackFridayRibbon.module.css";

/** Text stays in normal flow; only the decorative flourishes are positioned. */
export function BlackFridayRibbon() {
  return (
    <aside className={styles.ribbon} aria-label="Promoção Black Friday TCR">
      <svg className={styles.flourish} viewBox="0 0 160 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M-24 178C4 68 49 24 138-12M-15 117C19 58 52 30 98 5M0 192L21 215L128 226M-8 30L22 0L110-8" />
        <path className={styles.fine} d="M-16 207C19 101 59 45 145 5M-5 179L7 208L98 224" />
      </svg>
      <svg className={`${styles.flourish} ${styles.right}`} viewBox="0 0 160 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M-24 178C4 68 49 24 138-12M-15 117C19 58 52 30 98 5M0 192L21 215L128 226M-8 30L22 0L110-8" />
        <path className={styles.fine} d="M-16 207C19 101 59 45 145 5M-5 179L7 208L98 224" />
      </svg>
      <p className={styles.campaign}>SEMANA DA BLACK FRIDAY TCR</p>
      <p className={styles.headline}>GARANTA SEU INGRESSO COM DESCONTO!</p>
      <p className={styles.support}>Preço promocional por tempo limitado. Aproveite agora!</p>
    </aside>
  );
}
