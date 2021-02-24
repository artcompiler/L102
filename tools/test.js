import expect from 'chai';
import jsonDiff from 'json-diff';
import path from 'path';
import request from 'request';
import url from 'url';
import readline from 'readline';
const DATA_GATEWAY = 'https://gc.acx.ac/';
// const TEST_GATEWAY = 'https://gc.acx.ac/';
// const TEST_GATEWAY = 'https://gc.artcompiler.com/';
const TEST_GATEWAY = 'http://localhost:3000/';
const LANG_ID = 107;
const TIMEOUT_DURATION = 30000;

let pending = 0;
let scraped = {};
let RETRIES = 1;
let passed = 0;
let failed = 0;
function appendLine(str) {
  readline.cursorTo(process.stdout, 40);
  process.stdout.write(str);
}
function updateLine(str) {
  readline.clearLine(process.stdout);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(str);
}
function batchScrape(scale, force, ids, index, resume) {
  try {
    index = index || 0;
    if (index < ids.length) {
      let id = ids[index];
      let t0 = new Date;
      if (scraped[index] === undefined) {
        scraped[index] = 0;
      }
      pending++;
      getCompile(TEST_GATEWAY, id, function(err, val) {
        scraped[index]++;
        pending--;
        let result = true;
        if (err) {
          result = false;
        } else {
          val.score.forEach(s => {
            result = result && s && s.result === true;
          });
        }
        if (result) {
          passed++;
        } else {
          failed++;
        }
        if (result) {
          updateLine(
            "PASS " +
              (index + 1) + "/" + ids.length + ", " + id +
              ((color === 'grey' || color === 'red') && " in " + (new Date() - t0) + "ms\n" || " in " + (new Date() - t0) + "ms")
          );
        } else {
          updateLine(
            "FAIL " +
              (index + 1) + "/" + ids.length + ", " + id +
              ((color === 'grey' || color === 'red') && " in " + (new Date() - t0) + "ms" || " in " + (new Date() - t0) + "ms\n")
          );
        }
        while (pending < scale && index < ids.length) {
          index = index + 1;
          id = ids[index];
          if (scraped[index] === undefined) {
            batchScrape(scale, force, ids, index, resume);
          }
        }
      });
    } else if (pending === 0) {
      resume && resume();
    }
  } catch (x) {
    console.log("[7] ERROR " + x.stack);
    resume && resume("ERROR batchScrape");
  }
}
function getCompile(host, id, resume) {
  // appendLine("trying " + id);
  const hostUrl = new url.URL(host);
  hostUrl.searchParams.set('id', id);
  hostUrl.searchParams.set('refresh', 'true');
  hostUrl.searchParams.set('dontSave', 'true');
  hostUrl.pathname = '/data';
  request(hostUrl.toString(), function(err, res, body) {
    if (err) {
      return resume(err);
    } else if (res.statusCode !== 200) {
      resume(new Error(`compile ${host} returned ${res.statusCode}`));
    } else {
      try {
        body = JSON.parse(body);
        resume(null, body);
      } catch (e) {
        resume("ERROR not JSON: " + body);
      }
    }
  });
}
function getTimeStr(ms) {
  let secs = Math.floor(ms / 1000);
  let mins = Math.floor(secs / 60);
  return mins && mins + " minutes " + (secs % 60) + " seconds" || secs + " seconds";
}

const SCALE = 3;
const GREEN = 1;
const BLUE = 2;
const PURPLE = 3;
const GREY = 4;
const RED = -1;
const YELLOW = 0;
const color = process.argv[process.argv.length - 1] || GREEN;

getTests(function (err, testData) {
  testData = testData.slice(0); // Slice off leading tests when wanting to get to a particular test.
  console.log("Testing " + TEST_GATEWAY);
  console.log("Compiling " + testData.length + " tests");
  let t0 = new Date;
  batchScrape(SCALE, true, testData, 0, () => {
    updateLine(failed + " FAILED, " + passed + " PASSED in " + getTimeStr(new Date - t0) + "\n");
  });
});

function getTests(resume) {
  console.log(JSON.stringify(process.argv));
  let mark;
  switch (color) {
  case 'grey':
    mark = GREY;
    break;
  case 'purple':
    mark = PURPLE;
    break;
  case 'blue':
    mark = BLUE;
    break;
  case 'red':
    mark = RED;
    break;
  case 'green':
    mark = GREEN;
    break;
  default:
    mark = GREEN + ',' + BLUE;
    break;
  }
  console.log("Getting " + color + " tests...");  
  const hostUrl = new url.URL(DATA_GATEWAY);
  hostUrl.searchParams.set('table', 'items');
  hostUrl.searchParams.set('where', 'langid=' + LANG_ID + ' and mark in (' + mark + ')');
  hostUrl.searchParams.set('fields', ['itemid']);
  hostUrl.pathname = '/items';
  request(hostUrl.toString(), function(err, res, body) {
    if (err) {
      return resume(err);
    }
    if (res.statusCode !== 200) {
      resume(new Error(`compile returned ${res.statusCode}`));
    }
    let data = [];
    let smoke = process.argv.indexOf('--smoke') > 0;
    let tests = JSON.parse(body).data;
    if (smoke) {
      tests = shuffle(tests).slice(0, 100);
    } else {
      // Uncommment and use slice to narrow the test cases run with 'make test'.
      // tests = tests.slice(200, 250);
    }
    tests.forEach(d => {
      data.push(d.itemid);
    });
    resume(null, data);
  });
}
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;
  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}
