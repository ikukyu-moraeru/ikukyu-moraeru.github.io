import amazonCatalog from '../../data/amazon-products.json'
import './AmazonProductLinks.css'

const FEATURED_PRODUCT_IDS = [
  'sekisei-document-file',
  'working-mother-money',
] as const

export function AmazonProductLinks() {
  const products = FEATURED_PRODUCT_IDS.map(
    (id) => amazonCatalog.products[id],
  )

  return (
    <section className="apl" aria-labelledby="apl-title">
      <p className="apl__label">広告・Amazonアソシエイトリンク</p>
      <h2 className="apl__title" id="apl-title">
        手続きや家計管理に役立つもの
      </h2>
      <div className="apl__grid">
        {products.map((product) => {
          const url = `https://www.amazon.co.jp/dp/${product.asin}?tag=${encodeURIComponent(amazonCatalog.associateTag)}`
          return (
            <article
              className="apl-card"
              data-product-id={product.id}
              data-image-retrieved-at={product.imageRetrievedAt}
              key={product.id}
            >
              <a
                className="apl-card__image-link"
                href={url}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
              >
                <img
                  className="apl-card__image"
                  src={product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.closest('.apl-card')?.setAttribute('hidden', '')
                  }}
                />
              </a>
              <div className="apl-card__body">
                <h3 className="apl-card__name">{product.name}</h3>
                <p className="apl-card__reason">{product.reason}</p>
                <a
                  className="apl-card__link"
                  href={url}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                >
                  Amazonで見る →
                </a>
              </div>
            </article>
          )
        })}
      </div>
      <p className="apl__disclosure">
        Amazonのアソシエイトとして、育休もらえる？は適格販売により収入を得ています。
      </p>
    </section>
  )
}
