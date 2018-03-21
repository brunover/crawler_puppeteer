const puppeteer = require('puppeteer')
const jsonfile = require('jsonfile')
// const moment = require('moment')

const scrape = async () => {
  // Get the last 30 days to know when to stop searching
  // const back30Days = moment().subtract(30, 'days')

  const browser = await puppeteer.launch({
    headless: false
  })
  const page = await browser.newPage()

  await page.goto('https://www.empiricus.com.br/conteudo/newsletters/', {
    waitUntil: 'domcontentloaded'
  })

  const newsletters = await page.evaluate(() => {
    // Will contain all the scraped news
    let newsArray = []

    // Select all news from the page
    let pageNews = document.querySelectorAll('.list-item')

    for (let article of pageNews) {
      let image = article.querySelector('.list-item--thumb > img').getAttribute('src')
      let title = article.querySelector('.list-item--title').innerText.trim()
      let description = article.querySelector('.list-item--description').innerText.trim()

      let publishDate = article.querySelector('.list-item--info').innerText.trim()
      publishDate = publishDate.substring(publishDate.indexOf('- ') + 2).toLowerCase().replace(',', ' de')

      let url = article.querySelector('[id*="btn_post"]').href
      let text = ''

      newsArray.push({
        image,
        title,
        publishDate,
        description,
        url,
        text
      })
    }

    return newsArray
  })

  await browser.close()

  // Return the news to be inserted in a JSON file
  return newsletters
}

scrape().then((newsletters) => {
  // Creates a JSON file with the scraped data
  jsonfile.writeFile('newsletters.json', JSON.stringify(newsletters), function (err) {
    if (err) {
      console.error(err)
    } else {
      console.log('Finished scraping!')
    }
  })
})
