// jsdom globals for the UI tests (call once, before using the bundle)
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<body><div id="root"></div></body>', { pretendToBeVisual: true });
global.document = dom.window.document;
global.window = dom.window;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.XMLSerializer = dom.window.XMLSerializer;
global.Event = dom.window.Event;
global.Blob = dom.window.Blob;
module.exports = dom;
