(function() {

	/**
	 * The Progressatron is a plugin which makes the use of progress bars nice and easy. You have the ability to define
	 * the bar types and colours to use and will be provided with functions to call to change those bars dynamically.
	 * The bar can be created and configured with little code use and works as a great solution to a frequent problem
	 * of needing bars quickly with minimal effort.
	 *
	 * @author Christopher Sharman (Kriptonic on GitHub)
	 *
	 * @param overrides
	 * @returns {$.fn}
	 */
	$.fn.progressatron = function(overrides) {

		this.styles = {
			'progress-bar': {
				'width': '100%',
				'height': '30px',
				'background': '#CCC',
				'overflow': 'hidden'
			},
			'slider': {
				'width': '0',
				'height': '30px',
				'float': 'left'
			}
		};

		this.settings = $.extend({
			max: 100,
			bars: {
				'value': '#59B9E3'
			}
		}, overrides);

		this.value = 0;
		this.max = 100;

		this.parent = this;

		this.bar = null;
		this.label = null;

		buildPlugin(this);

		this.update = function() {
			for (var type in this.settings.bars) {
				var percentage = (this[type] / this.max) * 100;
				this['slider'+capitalize(type)].css({width: percentage + '%'});
			}
		};

		this.parent.append(this.bar);

		return this;
	}

	function capitalize(input) {
		return input[0].toUpperCase() + input.slice(1);
	}

	function buildPlugin(plugin) {

		var sliderTypes = plugin.settings.bars;

		plugin.bar = $('<div>').addClass('prog-bar bar');

		for (var type in sliderTypes) {
			var color = sliderTypes[type];

			// Dynamically create the properties for our sliders.
			plugin[type] = 0;

			// Create the slider HTML elements and add them to the bar component.
			var slider = $('<div>').css(plugin.styles.slider).css('background', color).attr('data-type', type);
			plugin['slider'+capitalize(type)] = slider;
			plugin.bar.append(slider);

			// Dynamically create the incrementSliderType functions, this saves us huge amounts of copy and paste.
			plugin['increment'+capitalize(type)] = new Function('amount', 'amount=amount||1;this.'+type+'+=amount;this.update()');
			plugin['decrement'+capitalize(type)] = new Function('amount', 'amount=amount||1;this.'+type+'-=amount;this.update()');
		}
	}

})();
