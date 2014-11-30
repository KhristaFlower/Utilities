(function($) {

	$(function() {

		/*
		 * When the page loads, lets parse the forms and compile all of the
		 * validation data that we know. By caching the status of the forms
		 * we can help speed up the time it takes to process changes.
		 */
		dataValidateControl = new ValidationControl();
		dataValidateControl.rebuildPageValidation();

		/*
		 * We perform a final check when the form is submit to ensure that
		 * everything is still valid. If any errors are found then the form
		 * will not be sent. Once all errors have been corrected then the
		 * user may proceed.
		 */
		$('form').submit(function() {

			// If this form isn't validated then allow the action to go ahead.
			if (!$(this).data('form-id')) {
				return true;
			}
			
			var formId = $(this).data('form-id');
			var formValid = true;
			
			// We need to verify that everything in the form validates properly.
			$.each($(this).find('input[data-validate]'), function(index, element) {
				
				var elementName = $(element).attr('name');
				var validator = dataValidateControl.validationCache[formId][elementName];
				if (!validator.validateAll()) {
					formValid = false;
				}
				
			});
			
			return formValid;
		});

	});

})(jQuery);

/*
 * This provides us a way to access the data-validate functions without
 * needing to pollute the global scope.
 *
 * dataValidateControl.rebuildPageValidation(); can be used to rebuild
 * all the validation on the page - Great for then you change whether
 * elements are on the page or not.
 */
var dataValidateControl = null;

//<editor-fold desc="Validation Control">

function ValidationControl() {
	"use strict";

	/*
	 * The validation cache stores information on forms, their inputs
	 * and their rules. This cache allows us to parse the validation
	 * rules once and then refer to them many times again later.
	 * It prevents the requirement for constant DOM manipulation.
	 */
	this.validationCache = {};

	/*
	 * This is a unique ID given to every form on the page, it is used to
	 * identify the form and its controls in the validation cache.
	 */
	this.uniqueFormId = 1;

}
ValidationControl.prototype.rebuildPageValidation = function() {
	"use strict";

	var validationControl = this;

	// Clear the current cache - We will re-create everything from scratch.
	validationControl.validationCache = {};
	validationControl.uniqueFormId = 1;

	jQuery('form').each(function() {

		// Grab a unique form Id and allocate it to the form.
		var formId = validationControl.uniqueFormId++;
		jQuery(this).data('form-id', formId);

		// Unfortunately required to prevent undefined errors in the next loop.
		validationControl.validationCache[formId] = {};

		/*
		 * Search the form for input elements that we can parse the validation
		 * rules for. We don't even want to consider elements without our
		 * data-validate tag. We also don't want to consider elements without
		 * a name attribute as they'll not be able to be cached using our method.
		 */
		jQuery.each(jQuery(this).find('input[data-validate][name],select[data-validate][name]'), function(index, element) {
			// Save a copy of the formId on the element, saves us doing jQuery searches later.
			jQuery(element).data('form-id', formId);
			validationControl.validationCache[formId][jQuery(this).attr('name')] = new Validator(element);
		});

	})

};

//</editor-fold>

//<editor-fold desc="Validator Object">

function Validator(input) {

	this.inputElement = input;
	this.validationString = $(input).data('validate');
	this.formId = $(input).data('form-id');
	this.elementName = $(input).attr('name').replace(/[^A-Za-z0-9_-]/g, '-');

	this.type = this.getType();
	this.optional = this.isOptional();
	this.rules = this.getRules();

	this.tooltipSetup();

}
/**
 * Validate a single rule and return whether or not it passed.
 *
 * @param rule {string} The name of the rule we wish to validate against.
 * @param arg {string} The modifier for the rule (for the rule 'min:3', this would be '3').
 * @returns {boolean} True if the validation passed, else false.
 */
Validator.prototype.validate = function(rule, arg) {
	if ($(this.inputElement).attr('disabled')) {
		return true;
	}
	if (this.validationInformation[this.type] == null) {
		throw new Error('Validation Information for \'' + this.type + '\' does not exist!');
	}
	if (this.validationInformation[this.type][rule] == null) {
		throw new Error('The rule \'' + rule + '\' for \'' + this.type + '\' does not exist!');
	}
	// If the element is optional and doesn't contain anything; don't validate it.
	if (this.optional && $(this.inputElement).val() == '') {
		return true;
	}
	var ruleTest = this.validationInformation[this.type][rule]['test'];
	return ruleTest($(this.inputElement).val(), arg);
};
/**
 * Validate all the rules for this object and return whether or not they all passed.
 *
 * @returns {boolean} True if all rules passed, else false.
 */
Validator.prototype.validateAll = function() {
	var validator = this;
	var allPassed = true;
	$.each(this.rules, function(rule, arg) {
		if (!validator.validate(rule, arg)) {
			allPassed = false;
		}
	});
	return allPassed;
};
/**
 * Extracts the core type this input should be in (string, integer, email, etc).
 *
 * @returns {string} The name of the type detected.
 */
Validator.prototype.getType = function() {
	var types = Object.keys(this.validationInformation).join('|');
	/*
	 * Input: 'hello|string|world'
	 * matches[0] ('|string|') is the actual match
	 * matches[1] ('string') is the capture
	 * matches is null if a result wasn't found.
	 */
	var typesRegex = new RegExp("(?:^|\\|)(" + types + ")(?:\\||$)");
	var matches = typesRegex.exec(this.validationString);
	if (matches == null) {
		throw new Error('Type not found in validation string \'' + this.validationString + '\'');
	}
	return (matches) ? matches[1] : null;
};
/**
 * Gets a list of rules for this object.
 *
 * Takes a string like 'integer|min:3|max:15' and extracts values
 * like 'min:3' and 'max:15', returning them in an object structured
 * as {rule:modifier}.
 *
 * @returns {{}} Rules object.
 */
Validator.prototype.getRules = function() {

	var regex = /(\w+):([\w,\/-]+)/g;

	/* rule: argument */
	var rules = {};

	// We add this to the rules because we will be validating this too.
	rules['type'] = this.type;

	while (true) {
		/*
		 * capture[0] is equal to the match
		 * capture[1] is the first capture group
		 * capture[2] is the second capture group
		 * etc...
		 */
		var capture = regex.exec(this.validationString);
		if (capture == null) {
			break;
		}
		rules[capture[1]] = capture[2];
	}

	return rules;
};
/**
 * Takes the validation string and determines whether or not the
 * element is optional.
 *
 * @returns {boolean} True if the element is optional, false otherwise.
 */
Validator.prototype.isOptional = function() {
	/*
	 * Matches 'optional', '|optional', 'optional|', '|optional|' only
	 * Ignores 'xxx:optional', 'optional:xxx', or any string containing 'optional'.
	 */
	return /(?:^|\|)(optional)(?:\||$)/i.test(this.validationString);
};
/**
 * A collection of types and the rules they can contain with hints and
 * the tests performed to determine the validation outcome.
 *
 * @type {{string: {type: {hint: string, test: Function}}}}
 */
Validator.prototype.validationInformation = {
	'string': {
		'type': {
			'hint': 'Must be a string of characters',
			'test': function(value) {
				return typeof value == 'string' && value.length > 0;
			}
		},
		'min': {
			'hint': 'Must be at least {arg} characters long',
			'test': function(value, arg) {
				return value.length >= arg;
			}
		},
		'max': {
			'hint': 'Must not be longer than {arg} characters long',
			'test': function(value, arg) {
				return value.length <= arg;
			}
		},
		'matches': {
			'hint': 'Must match the {arg} field',
			'test': function(value, arg) {
				return value == $('input[name="'+arg+'"]').val();
			}
		}
	},
	'integer': {
		'type': {
			'hint': 'Must be a whole number',
			'test': function(value) {
				return /^(\d+)$/.test(value) && value % 1 === 0;
			}
		},
		'min': {
			'hint': 'Must be greater than or equal to {arg}',
			'test': function(value, arg) {
				return /^(\d+)$/.test(value) && parseFloat(value) >= arg;
			}
		},
		'max': {
			'hint': 'Must be smaller than or equal to {arg}',
			'test': function(value, arg) {
				return /^(\d+)$/.test(value) && parseFloat(value) <= arg;
			}
		}
	},
	'float': {
		'type': {
			'hint': 'Must be a number',
			'test': function(value) {
				return /^(\d+\.\d+|\d+)$/.test(value) && !isNaN(parseFloat(value));
			}
		},
		'min': {
			'hint': 'Must be greater than or equal to {arg}',
			'test': function(value, arg) {
				return /^(\d+\.\d+|\d+)$/.test(value) && parseFloat(value) >= arg;
			}
		},
		'max': {
			'hint': 'Must be smaller than or equal to {arg}',
			'test': function(value, arg) {
				return /^(\d+\.\d+|\d+)$/.test(value) && parseFloat(value) <= arg;
			}
		}
	},
	'email': {
		'type': {
			'hint': 'Must be a valid Email address',
			'test': function(value) {
				// This is the 'catch-most-cases' expression of 47 characters in length.
				// There is a 'catch-all' expression but its 6264 characters in length...
				return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(value)
			}
		}
	},
	'postcode': {
		'type': {
			'hint': 'Must be a valid UK postcode',
			'test': function(value) {
				/*
				 * This is more complicated than you might expect because not all parts
				 * of the postcode make use of all alphabets.
				 */
				return /^([a-zA-Z])([0-9][0-9]|[0-9]|[a-zA-Z][0-9][a-zA-Z]|[a-zA-Z][0-9][0-9]|[a-zA-Z][0-9])([ ])([0-9][a-zA-z][a-zA-z])$/.test(value)
			}
		}
	},
	'date': {
		'type': {
			'hint': 'Must be a date',
			'test': function(value) {
				/*
				 * Tests to see if the string is a date.
				 * Accepts formats: '00/00/0000', '0000/00/00', '00-00-0000', '0000-00-00'
				 */
				return /^\d{2}(?:\/|-)\d{2}(?:\/|-)\d{4}$|^\d{4}(?:\/|-)\d{2}(?:\/|-)\d{2}$/.test(value);
			}
		},
		'format': {
			'hint': 'Must be a valid {arg} date',
			'test': function(value, arg) {
				// We have to do 'new RegExp()' here because we are calculating the expression
				// at runtime. This costs more to do but is required.
				var regex = new RegExp("^" + arg.replace(/[DMY]/g, '\\d').replace('/', '\/') + "$");
				var rightFormat = regex.test(value);
				if (!rightFormat) {
					// No point in doing all the below if we know the validation has failed already.
					return false;
				}

				var formatParts = arg.split(/[-/]/g);
				var valueParts = value.split(/[-/]/g);

				var year = 0;
				var month = 0;
				var day = 0;

				// If anyone can think of a nicer way to extract the date parts, that would be great.
				$.each(formatParts, function(index, part) {
					if (part[0] == 'D') {
						day = valueParts[index];
					} else if (part[0] == 'M') {
						month = valueParts[index];
					} else if (part[0] == 'Y') {
						year = valueParts[index];
					}
				});

				/*
				 * Construct a date object. If any date component (day/month/etc) is bigger than
				 * expected, then the date will overflow and give us something back which doesn't
				 * match the original input.
				 * For example the date '29-02-1991' fails because Feb 1991 wasn't a leap year.
				 * However 1992 which was a leap year allows the date '29-02-1992' to pass.
				 */
				var date = new Date(year, month - 1, day);

				return (rightFormat && date.getFullYear() == year && date.getMonth() + 1 == month && date.getDate() == day);
			}
		}
	},
	'mobile': {
		'type': {
			'hint': 'Must be a valid UK mobile phone number',
			'test': function(value) {
				// Complex I know but I don't want to be moaned at when someone can't enter something specific...
				return /^((\(44\))( )?|(\(\+44\))( )?|(\+44)( )?|(44)( )?)?((0)|(\(0\)))?( )?(((1[0-9]{3})|(7[1-9][0-9]{2})|(20)( )?[7-8])( )?([0-9]{3}[ -]?[0-9]{3})|(2[0-9]{2}( )?[0-9]{3}[ -]?[0-9]{4}))$/.test(value) && !/^077{8,12}$/.test(value);
			}
		}
	},
	'select': {
		'type': {
			'hint': 'Must be a valid option.',
			'test': function(value) {
				return value.length > 0;
			}
		}
	}
};
/**
 * Convert a hint into something that has context with the current element.
 *
 * Takes a hint like: 'Maximum value of {arg}'
 * And a rule like: 'maximum:10'
 * And produces the output of 'Maximum value of 10'
 *
 * @param rule {string} The rule to get the hint for.
 * @param arg {string} The extra information about the validation rule modifier.
 * @returns {string} The hint text.
 */
Validator.prototype.getRuleText = function(rule, arg) {
	return this.validationInformation[this.type][rule]['hint'].replace('{arg}', arg);
};
/**
 * This function configures the tooltips that will be shown as well as their
 * events required to make them show and hide as well as updating the
 * validation rules.
 */
Validator.prototype.tooltipSetup = function() {

	var validator = this;
	var tooltipIdentifier = ['data-validate-tooltip', this.formId, this.elementName].join('-');
	var tooltip = $('<div>').addClass('data-validate-tooltip '+tooltipIdentifier);
	var fadeSpeed = 150;

	// Locate the first item in the row the input is in.
	var item = $(this.inputElement).closest('.row').children('.item').first();

	var allRulesPassed = true;

	$.each(this.rules, function(rule, arg) {
		var passedValidation = validator.validate(rule, arg);
		if (!passedValidation) {
			allRulesPassed = false;
		}
		var tooltipHintIdentifier = ['data-validate-tooltip', validator.formId, validator.elementName, rule].join('-');
		var hint = $('<li>').text(validator.getRuleText(rule, arg))
			.addClass(tooltipHintIdentifier)
			.addClass('data-validate-'+(passedValidation ? 'passed' : 'failed'));
		tooltip.append(hint);
	});
	if (allRulesPassed) {
		$(tooltip).fadeOut(fadeSpeed);
		$(validator.inputElement).removeClass('data-validate-failed').addClass('data-validate-passed');
	} else {
		$(tooltip).fadeIn(fadeSpeed);
		$(validator.inputElement).removeClass('data-validate-passed').addClass('data-validate-failed');
	}
	if (this.optional) {
		var optional = $('<li>').text('Optional');
		tooltip.prepend(optional.clone());
	}

	/*
	 * Set up some events for showing/hiding the popup as well as
	 * re-validating the form when changes have taken place.
	 */
	$(validator.inputElement).focus(function() {
		/*
		 * Make the tooltip show next to the element when we select it.
		 */
		$(validator.inputElement).after(tooltip.css({display: 'none'}).fadeIn(fadeSpeed));
	}).blur(function() {
		/*
		 * Remove the tooltip once we move outside of the input.
		 */
		$(tooltip).fadeOut(fadeSpeed, function() {$(this).remove();});
	}).keydown(function() {
		validator.updateValidationState(validator);
	}).keyup(function() {
		validator.updateValidationState(validator);
	}).change(function() {
		validator.updateValidationState(validator);
	});

};

Validator.prototype.updateValidationState = function(validator) {

	/*
	 * Whenever changes are made to the input, we wish to re-validate
	 * that everything still meets our requirements.
	 * Unfortunately we have to put this inside a timeout because
	 * $(this).val() doesn't equal the changes that fired this
	 * event. setTimeout works around this, albeit a messy solution.
	 */
	setTimeout(function() {

		// Benefit of the doubt.
		var allPassed = true;

		$.each(validator.rules, function(rule, arg) {
			var passedValidation = validator.validate(rule, arg);
			var tooltipHintIdentifier = ['data-validate-tooltip', validator.formId, validator.elementName, rule].join('-');
			if (passedValidation) {
				$('.'+tooltipHintIdentifier).removeClass('data-validate-failed').addClass('data-validate-passed');
			} else {
				allPassed = false;
				$('.'+tooltipHintIdentifier).removeClass('data-validate-passed').addClass('data-validate-failed');
			}
		});
		if (allPassed) {
			$(validator.inputElement).removeClass('data-validate-failed').addClass('data-validate-passed');
		} else {
			$(validator.inputElement).removeClass('data-validate-passed').addClass('data-validate-failed');
		}

	}, 0);

};

//</editor-fold>
