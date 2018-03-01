// boilerplate reduction: instantiates missing selection data elements with the
// given template, returns the merged selection.
const instantiateTemplates = (selection, template) => {
  const created = selection.enter().append(() => template.clone(true).node());
  return selection.merge(created);
};

// same thing, but initiates divs of a given class.
const instantiateDivs = (selection, className) => {
  const created = selection.enter().append('div').classed(className, true);
  return selection.merge(created);
};

module.exports = { instantiateTemplates, instantiateDivs };

