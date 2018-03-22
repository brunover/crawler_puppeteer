/**
 * @name ScrapeEmpiricusNews
 * @desc Scrapes 'https://www.empiricus.com.br/conteudo/newsletters/' for articles and creates JSON with the ones from the last 30 days
 * @author Bruno Leandro de Lima
 */
const puppeteer = require('puppeteer')
const jsonfile = require('jsonfile')
const moment = require('moment')

// Months in 'pt-br' to be converted to a JS Date Object
const months = 'janeiro_fevereiro_março_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro'.split('_')

// Transform the date string in the article to a JS Date Object
const convertEmpiricusDate = (dateStr) => {
  let dateArr = dateStr.substring(dateStr.indexOf('- ') + 2).toLowerCase().replace(',', ' de').split(' de ')
  let monthInt = months.indexOf(dateArr[1]) + 1
  let publishDateStr = dateArr[0] + '/' + (monthInt < 10 ? ('0' + monthInt) : ('' + monthInt)) + '/' + dateArr[2]
  return moment(publishDateStr, 'DD/MM/YYYY').toDate()
}

const scrape = async () => {
  // If it reaches an article equal or older than 30 days, stops scraping
  let keepScraping = true

  // Page to scrape
  let currentPage = 'https://www.empiricus.com.br/conteudo/newsletters/'

  // Get the last 31 days to know when to stop
  let back30Days = moment().subtract(31, 'days')

  // Array with the newsletters that will be saved
  let newsletters = []

  const browser = await puppeteer.launch({
    headless: true // Turn to 'false' to see the magic happening!
  })

  const page = await browser.newPage()

  console.log('Starting! Will keep scraping until it finds an article equal or older than (' + moment(back30Days).format('DD/MM/YYYY') + ')')

  while (keepScraping) {
    console.log('Current page: ' + currentPage)

    await page.goto(currentPage, {
      waitUntil: 'domcontentloaded'
    })

    let pageInfos = await page.evaluate(() => {
      // Url of the next page
      let nextPage = document.querySelector('.next').href

      // Select all news from the page
      let pageArticles = document.querySelectorAll('.list-item')

      // Will contain all the scraped news
      let articlesArray = []

      for (let article of pageArticles) {
        try {
          let publishDate = article.querySelector('.list-item--info').innerText.trim()
          let title = article.querySelector('.list-item--title').innerText.trim()
          let description = article.querySelector('.list-item--description').innerText.trim()
          let url = article.querySelector('[id*="btn_post"]').href
          let text = ''

          let image = ''

          // Sometimes the articles does not have cover images...
          if (article.querySelector('.list-item--thumb > img') != null) {
            image = article.querySelector('.list-item--thumb > img').getAttribute('src')
          }

          articlesArray.push({
            image,
            title,
            publishDate,
            description,
            url,
            text
          })
        } catch (e) {
          // If an error occur and the article could not be extracted, print error and go to the next
          console.error(e)
          continue
        }
      }

      return {
        articlesArray,
        nextPage
      }
    })

    // Url of the next page to scrape
    currentPage = pageInfos.nextPage

    // Go over the articles to obtain the text and check de date
    let articlesArray = pageInfos.articlesArray

    for (let article of articlesArray) {
      // Transform the date string in the article to a JS Date Object
      let publishDate = convertEmpiricusDate(article.publishDate)

      if (moment(publishDate).isBefore(back30Days)) {
        console.log('Found article from date (' + moment(publishDate).format('DD/MM/YYYY') + '). Stoping operation.')
        keepScraping = false
        break
      }

      // Change the date in article object to a JS Date Object that can be used anywhere
      article.publishDate = publishDate

      // Go to the article page
      await page.goto(article.url, {
        waitUntil: 'domcontentloaded'
      })

      let scrapedArticleText = await page.evaluate(() => {
        let html = ''

        try {
          html = document.querySelector('.article--content').innerHTML
        } catch (e) {
          console.error(e)
        }

        return html
      })

      // Add the scraped text into the object
      article.text = scrapedArticleText

      // Add the article to the group of newsletters that will be returned
      newsletters.push(article)

      // Go back to the newsletters page
      await page.goBack()
    }
  }

  // Close browser
  await browser.close()

  // Return the news to be inserted in a JSON file
  return newsletters
}

scrape().then(newsletters => {
  // Creates a JSON file with the scraped data
  jsonfile.writeFile('newsletters.json', newsletters, function (err) {
    if (err) {
      console.error(err)
    } else {
      console.log('Finished! Qty of scraped articles: ' + newsletters.length)
    }
  })
})
