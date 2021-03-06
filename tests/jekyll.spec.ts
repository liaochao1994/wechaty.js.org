#!/usr/bin/env ts-node

/**
 * Issue #298: https://github.com/wechaty/wechaty.js.org/issues/298
 *  Common pitfalls #298
 *
 * The goal of all these unit tests in this file is to
 * help the developers who is submitting their blog posts via the PR
 * to follow all styles from our website rules.
 *
 * And the most important is to check for errors early via the CI tools.
 */

import test  from 'tstest'

import fs from 'fs'
import path from 'path'
import util from 'util'

import probeImageSize from 'probe-image-size'
import globCB         from 'glob'
import { loadFront }  from 'yaml-front-matter'

import {
  getFrontmatterTeaserList,
  getMarkdownImageList,
  getYearMonth,
  JEKYLL_FOLDER,
}                             from '../src/jekyll/mod'

import {
  REPO_ROOT,
  stripRepoRoot,
}                             from '../src/repo-root'

const glob = util.promisify(globCB)

test('image size should be fit for the web (no more than 1MB and 1920x1080)', async t => {
  const MAX_WIDTH = 1920         // HD
  const MAX_SIZE  = 1024 * 1024  // 1MB

  const fileList = await glob(`${JEKYLL_FOLDER.assets}/**/*.{jpg,jpeg,png}`)
  t.true(fileList.length > 0, 'should get image file list')

  for (const file of fileList) {
    const dim = await probeImageSize(fs.createReadStream(file))
    const size = fs.statSync(file).size

    const fit = dim.width <= MAX_WIDTH && size <= MAX_SIZE
    t.true(fit, `"${stripRepoRoot(file)}" should not exceed the max limit: width: ${dim.width}, size: ${size}.`)

    if (!fit) {
      console.error(`use "scripts/fit-image.sh <FILE>" to adjust it fit MAX_WIDTH: ${MAX_WIDTH} & MAX_SIZE: ${MAX_SIZE}`)
    }

  }
})

test('miss placed files', async t => {
  const DEPRECATED_FOLDER_LIST = {
    // 👇 https://github.com/wechaty/wechaty.js.org/pull/648/commits/6e435f65ef26b251375561b5c82d1b66cc2d7619
    jekyll  : 'jekyll/*.md',
  }

  const WHITE_LIST = [
    'jekyll/README.md',
  ]

  const isNotWhiteListed = (file: string) => !WHITE_LIST.includes(file)

  const missPlacedFileListList = await Promise.all(
    Object.values(DEPRECATED_FOLDER_LIST)
      .map(matchGlob => path.join(REPO_ROOT, matchGlob))
      .map(matchGlob => glob(matchGlob))
  )
  const missPlacedFileList = missPlacedFileListList
    .flat()
    .map(stripRepoRoot)
    .filter(isNotWhiteListed)

  const isGood = missPlacedFileList.length === 0
  t.true(isGood, `should no miss placed files. ${missPlacedFileList.join(', ')}`)
})

test('folder _developers/ and _posts/ has been moved to `jekyll/` (e.g. _posts/ => jekyll/_posts/)', async t => {
  const DEPRECATED_FOLDER_LIST = {
    _developer  : '_developer might a typo of `jekyll/_developers`',
    _developers : '_developers/ has been moved to `jekyll/_developers`',
    // 👇 https://github.com/wechaty/wechaty.js.org/pull/648
    _post       : '_post might a typo of `jekyll/_posts`',
    _posts      : '_posts/ has been moved to `jekyll/_posts`',
  }

  for (const [folder, memo] of Object.entries(DEPRECATED_FOLDER_LIST)) {
    const existDeprecatedFolder = fs.existsSync(path.join(REPO_ROOT, folder))
    t.false(existDeprecatedFolder, `${folder}/ should not exist: ${memo}`)
  }
})

/**
 * Issue #325: Keep all filenames & url as lowercase, and use - to connect words instead of spac
 *  https://github.com/wechaty/wechaty.js.org/issues/325
 *
 * Issue #585: Blog post author should be all lowercase #585
 *  https://github.com/wechaty/wechaty.js.org/issues/585
 */
test('filename only allow [a-z0-9-_.]', async t => {
  const REGEX = /^[a-z0-9/_.-]+$/
  const WHITE_LIST_REGEX_LIST = [
    new RegExp('/assets/js/viewer-js'),
  ]

  const assetsFileList  = await glob(`${JEKYLL_FOLDER.assets}/**/*`)
  const postsFileList   = await glob(`${JEKYLL_FOLDER.posts}/**/*`)
  const developersFileList = await glob(`${JEKYLL_FOLDER.developers}/**/*`)

  const isNotWhiteList = (filename: string) => WHITE_LIST_REGEX_LIST.every(regex => !regex.test(filename))

  const filenameList = [
    ...assetsFileList,
    ...developersFileList,
    ...postsFileList,
  ].filter(isNotWhiteList)
    .map(stripRepoRoot)

  for (const filename of filenameList) {
    const ok = REGEX.test(filename)
    t.true(ok, `"${filename}" contains all lowercase and no specicial characters`)
  }
})

test('front matter key `tags` must contact at least one tag and not black listed', async t => {
  const TAG_BLACK_LIST = [
    'wechaty', // we should not add wechaty because everything is related to wechaty
    // TODO: should we permit space in tag name?
    // TODO: should we only permit the lowercase tag characters? or CamelCase?
  ]
  const isNotBlackList = (tag: string) => !TAG_BLACK_LIST.includes(tag)
  const isNotIncludeSpace = (tag: string) => !/\s+/.test(tag)

  const postsFileList = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const file of postsFileList) {
    const content = fs.readFileSync(file)
    const front = loadFront(content)

    let tagList  = front.tags
    if (!Array.isArray(tagList)) {
      tagList = tagList
        ? [tagList]
        : []
    }
    t.true(tagList.length, `"${stripRepoRoot(file)}" tags(${tagList.length}) has at least one tag`)

    const notBlackListed = tagList.every(isNotBlackList)
    t.true(notBlackListed, `"${stripRepoRoot(file)}" tags(${notBlackListed ? tagList.length : tagList.join(',')}) has no black listed`)

    const notIncludeSpace = tagList.every(isNotIncludeSpace)
    t.true(notIncludeSpace, `"${stripRepoRoot(file)}" tags(${notIncludeSpace ? tagList.length : tagList.join(',')}) does not include space in tag`)
  }
})

test('front matter key `categories` must contains at lease one preset category', async t => {
  const PRESET_CATEGORIES_LIST = [
    'announcement',
    'article',
    'event',
    'feature',
    'fun',
    'hacking',
    'interview',
    'migration',
    'npm',
    'project',
    'shop',
    'story',
    'tutorial',
  ]
  const isPreset = (category: string) => PRESET_CATEGORIES_LIST.includes(category)

  const postsFileList   = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const file of postsFileList) {
    const content       = fs.readFileSync(file)
    const front         = loadFront(content)

    let categoryList  = front.categories
    if (!Array.isArray(categoryList)) {
      categoryList = categoryList
        ? [categoryList]
        : []
    }

    t.true(categoryList.length, `"${stripRepoRoot(file)}" categories(${categoryList.length}) has at lease one category`)

    const allPreset = categoryList.every(isPreset)
    t.true(allPreset, `"${stripRepoRoot(file)}" categories(${categoryList.join(',')}) is in preset(${allPreset ? '...' : PRESET_CATEGORIES_LIST.join(',')})`)
  }
})

test('files in `_posts/` must have name prefix with `YYYY-MM-DD-`', async t => {
  const REGEX = /\/\d\d\d\d-\d\d-\d\d-.+/
  const postsFileList   = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const filename of postsFileList) {
    const good = REGEX.test(filename)
    t.true(good, `"${filename}" have name started with YYYY-MM-DD-`)
  }
})

test('files in `_posts/` must contain at least three slugs connected by dash after the date prefix (slug1-slug2-slug3)', async t => {
  const PREFIX_REGEX = /^.+\/\d\d\d\d-\d\d-\d\d-/
  const postsFileList   = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const filename of postsFileList) {
    let name = filename.replace(PREFIX_REGEX, '')
    name = name.replace(/\.md$/, '')

    const slugList = name.split('-')
    const good = slugList.length >= 3

    t.true(good, `"${filename.replace(JEKYLL_FOLDER.posts + '/', '')}" have at least 3 slugs`)
  }
})

test('files in `_posts/` must end with `.md` file extension', async t => {
  const REGEX = /\.md$/
  const postsFileList   = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const filename of postsFileList) {
    const good = REGEX.test(filename)
    t.true(good, `"${stripRepoRoot(filename)}" end with .md`)
  }
})

test('front matter key `author` should has a value exist in jekyll/_developers/__VALUE__.md file', async t => {
  const postsFileList = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const file of postsFileList) {
    const content = fs.readFileSync(file)
    const front = loadFront(content)
    const author = front.author
    t.true(author, `"${stripRepoRoot(file)}" author has been set to ${author}`)

    const authorFile = path.join(JEKYLL_FOLDER.root, '_developers', author + '.md')
    const good = fs.existsSync(authorFile)
    t.true(good, `"${stripRepoRoot(file)}" author profile at ${stripRepoRoot(authorFile)}`)
  }
})

test('developer profile file (jekyll/_developers/__AUTHOR__.md) filename must match /[a-z0-9_-.]+/', async t => {
  const REGEX = new RegExp('/[a-z0-9_.-]+.md$')

  const developersFileList = await glob(`${JEKYLL_FOLDER.developers}/**/*`)
  const nameList = developersFileList.map(stripRepoRoot)

  for (const filename of nameList) {
    const good = REGEX.test(filename)
    t.true(good, `"${filename}" is match ${REGEX}`)
  }
})

/**
 * Issue #351: https://github.com/wechaty/wechaty.js.org/issues/351
 *  Should add teaser for the blog
 */
test('front matter key `image` must has a value to define the teaser image', async t => {
  const postsFileList   = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const file of postsFileList) {
    const { year } = getYearMonth(file)
    /**
     * Huan(202101): We leave the posts before 2021 as it is
     */
    if (parseInt(year) < 2021) {
      continue
    }

    const content = fs.readFileSync(file)
    const front = loadFront(content)
    const image = front.image
    t.true(image, `"${stripRepoRoot(file)}" image(${image}) has been set`)
  }
})

test('developer project avatar should be put under assets/developers/ folder', async t => {
  const developersFileList = await glob(`${JEKYLL_FOLDER.developers}/*.md`)

  for (const file of developersFileList) {
    const content = fs.readFileSync(file)
    const front   = loadFront(content)

    t.true(front.avatar, `"${stripRepoRoot(file)}" should have avatar("${front.avatar}")`)

    const startWithSlash = /^\//.test(front.avatar)
    t.true(startWithSlash, `"${front.avatar}" should start with '/'`)

    if (/^http/i.test(front.avatar)) {
      t.fail(`${stripRepoRoot(file)} should put avatar files to local repo instead of using URL`)
    } else {
      const filename = path.join(JEKYLL_FOLDER.root, front.avatar)
      const good = fs.existsSync(filename)
      t.true(good, `${stripRepoRoot(filename)} should exist`)
    }
  }
})

test('all images linked from the post should be stored local (in the repo) for preventing the 404 error in the future.', async t => {
  const URL_WHITE_LIST_REGEX = [
    /badge\.fury\.io/i,
    /dockeri\.co\/image/i,
    /github\.com\/.*\/workflows\//i,
    /githubusercontent\.com/i,
    /herokucdn\.com/i,
    /images\.microbadger\.com/i,
    /img\.shields\.io/i,
    /pepy\.tech\/badge/i,
    /sourcerer\.io/i,
    /wechaty\.github\.io/i,
    /wechaty\.js\.org/i,
  ]
  const isNotWhiteList = (url: string) => !URL_WHITE_LIST_REGEX.some(regex => regex.test(url))

  const postsFileList      = await glob(`${JEKYLL_FOLDER.posts}/*.md`)
  const developersFileList = await glob(`${JEKYLL_FOLDER.developers}/*.md`)

  const getAvatarList = (file: string): string[] => {
    const front = loadFront(fs.readFileSync(file))
    if (front.avatar) {
      return [front.avatar]
    }
    return []
  }

  const allImageList = [
    ...postsFileList.map(getFrontmatterTeaserList).flat(),
    ...postsFileList.map(getMarkdownImageList).flat(),
    ...developersFileList.map(getAvatarList).flat(),
  ].filter(isNotWhiteList)

  for (const image of allImageList) {
    if (/^http/i.test(image)) {
      t.fail(`"${image}" should put image files to local repo instead of using URL`)
    } else {
      const filename = path.join(JEKYLL_FOLDER.root, image)
      const good = fs.existsSync(filename)
      t.true(good, `"${image}" should exist`)
    }
  }
})

test('all asset files should be put into folder `/assets/YYYY/MM-slug-...-slug/` (slugs should be the same as the post)', async t => {
  const postsFileList = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const filename of postsFileList) {
    const { year, month } = getYearMonth(filename)

    /**
     * Huan(202101): do not check paths before 2021
     */
    if (parseInt(year) < 2021) {
      continue
    }

    const teaserList = getFrontmatterTeaserList(filename)
    const imageList  = getMarkdownImageList(filename)

    // console.info('processing: ', filename)
    // console.info('teaserList:', teaserList.length)
    // console.info('imgeList:', imageList.length)

    const slugs = getSlugs(filename)
    const expectedFolder = path.join(
      'assets',
      year,
      `${month}-${slugs}`,
    )

    for (const imageFile of [...teaserList, ...imageList]) {
      const good = imageFile.includes(expectedFolder)
      t.true(good, `"${imageFile}" from "${stripRepoRoot(filename)}" should be save to "${expectedFolder}/"`)
    }
  }

  function getSlugs (filename: string): string {
    const matches = filename.match(/\/\d\d\d\d-\d\d-\d\d-(.+)\.md$/)
    if (!matches) {
      throw new Error(`${filename} parse slugs fail`)
    }
    return matches[1]
  }
})

test('{% include iframe.html src=... %} should exist in assets/ folder', async t => {
  const postsFileList = await glob(`${JEKYLL_FOLDER.posts}/**/*`)

  for (const filename of postsFileList) {
    const fileList = getIncludeSrcList(filename)
    if (fileList.length) {
      const good = fileList.every(isExist)
      t.true(good, `${fileList.map(s => `"${s}"`).join(', ')} should exist`)
    }
  }

  function isExist (file: string): boolean {
    return fs.existsSync(path.join(JEKYLL_FOLDER.root, file))
  }

  function getIncludeSrcList (filename: string): string[] {
    const content = fs.readFileSync(filename).toString()

    // '{% include iframe.html src="/assets/2020/11-summer-2020-summit-talks/wechaty-summer-2020-introduction.pdf" %}'
    const REGEXP = /{%\s+include\s+iframe.html\s+src="\/([^"]+?)"\s+%}/g

    const fileList: string[] = []

    let matches = REGEXP.exec(content)
    while (matches != null) {
      fileList.push(matches[1])
      matches = REGEXP.exec(content)
    }

    return fileList
  }

})
