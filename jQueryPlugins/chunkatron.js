(function () {

	/**
	 * The Chunkatron's purpose is to download lots of data via seperate calls. When reports take a long time to load,
	 * it is better to pass the Chunkatron the Ids for the object you want in the report and have it download them
	 * in batches for compilation on the client side.
	 *
	 * @author Christopher Sharman (Kriptonic on GitHub)
	 * @param overrides
	 * @returns {$.fn}
	 */
	$.fn.chunkatron = function (overrides) {

		// If any of these overrides are missing, an error will be thrown.
		var requiredOptions = ['url', 'onChunkComplete'];

		// Default options to be overrided.
		var defaultOptions = {
			// Required options
			url: null, onChunkComplete: null, /* and either */ chunks: null, /* or */ chunksUrl: null,
			// Events (optional)
			onComplete: null, onChunkSuccess: null, onChunkError: null, onChunkGiveUp: null, onFinished: null,
			// Other (optional)
			verbose: false, dataType: 'json', maxDownloadRetries: 3, concurrentDownloadsMax: 10
		};

		// Load in the default settings and override them with the ones provided.
		this.settings = $.extend(defaultOptions, overrides);

		/**
		 * The number of simultaneous downloads we have going.
		 * @type {number}
		 */
		this.concurrentDownloads = 0;

		/**
		 * We store the chunks that have failed to download and the number of retry attempts here.
		 * @type {Array}
		 */
		this.chunkFailures = [];

		/**
		 * Ensure the required settings have been provided.
		 */
		this.verifySettings = function () {
			for (var setting in this.settings) {
				// Only check properties on the object, not those it obtained via the prototype.
				if (this.settings.hasOwnProperty(setting)) {
					if ($.inArray(setting, requiredOptions) >= 0 && this.settings[setting] == null) {
						throw new Error('Chunkatron requires a value for the \'' + setting + '\' setting');
					}
				}
			}
			if (this.settings.chunks == null && this.settings.chunksUrl == null) {
				throw new Error('Either the chunks or the chunksUrl must be provided');
			}
		};

		/**
		 * Download a chunk of data.
		 */
		this.downloadChunk = function () {

			if (this.settings.verbose) console.log('Chunk download starting... There are ' + this.chunks.length + ' chunk(s) remaining.');

			// We wish to avoid having too many downloads running at once.
			if (this.concurrentDownloads >= this.settings.concurrentDownloadsMax) {
				return;
			}

			// Grab the chunk at the front of the list.
			var currentChunk = this.chunks.shift();

			// If we don't have a chunk at this point, it's because none are left and all have been dealt with.
			if (currentChunk == null) {
				if (this.settings.verbose) console.log('We are finished!');
				this.callback(this.settings.onFinished);
				return;
			}

			// Store a reference to the first item, we wish to stop making download attempts if it keeps failing.
			if (this.chunkFailures[currentChunk[0]] > this.settings.maxDownloadRetries) {
				// Pass the failed chunk back for analysis.
				this.callback(this.settings.onChunkGiveUp, currentChunk);
				// Start another.
				this.downloadChunk();
				if (this.settings.verbose) console.log('Given up on a chunk! Failed to download after', this.settings.maxDownloadRetries, 'attempt(s)');
				return;
			}

			// Update the number of concurrent downloads.
			this.concurrentDownloads++;

			// 'this' from within the $.ajax callbacks doens't refer to the current object anymore, var self will get around this.
			var self = this;

			// Make the request for the chunk.
			$.ajax({
				url: this.settings.url,
				method: 'POST',
				dataType: this.settings.dataType,
				data: {
					chunk: currentChunk
				},
				// Called when the request was successful.
				success: function (data, status, xhr) {
					// Send the data we recieved to the user-defined callback (it is not our job to process it).
					self.callback(self.settings.onChunkSuccess, data);
				},
				// Called when there was an error - Usually going to be 404 or 504
				error: function (xhr, status, error) {
					// Keep a record of this chunk failing.
					var chunkIdentifier = currentChunk[0];
					self.chunkFailures[chunkIdentifier] = (self.chunkFailures[chunkIdentifier] == null) ? 1 : self.chunkFailures[chunkIdentifier] + 1;
					// Add the chunk back onto the stack, we can try again later.
					self.chunks.push(currentChunk);
					self.callback(self.settings.onChunkError, error);
				},
				// This function is ran after success and error.
				complete: function (xhr, status) {
					// This download is finished (success or error, doesn't matter).
					self.concurrentDownloads--;
					self.callback(self.settings.onChunkComplete);
					// Start a new download.
					self.downloadChunk();
				}
			});

		};

		/**
		 * Used to fire callbacks/events that occour during the downloading process.
		 * @param callback
		 */
		this.callback = function (callback, params) {
			if (typeof callback == 'function') {
				if (params) {
					callback(params);
				} else {
					callback();
				}
			} else if (callback != null) {
				throw new Error('The callback must be a function (or null if you don\'t want one)');
			}
		};

		// Check to ensure we have all the settings we need to operate.
		this.verifySettings();

		/**
		 * Start the downloading process.
		 * We wrap this inside of a function so that it can be called after the chunks have been downloaded from
		 * the provided URL if that was the route to be taken.
		 */
		this.start = function() {
			// Set the easier to access variables.
			this.chunks = this.settings.chunks;

			// Start the downloading process by sending as many requests as the limit allows for.
			for (var i = 0; i < this.settings.concurrentDownloadsMax; i++) {
				this.downloadChunk();
			}
		};

		// If a chunksUrl was provided, download the chunks.
		if (this.settings.chunks == null && this.settings.chunksUrl != null) {
			var self = this;
			$.ajax({
				url: this.settings.chunksUrl,
				dataType: this.settings.dataType,
				success: function(data) {
					self.settings.chunks = data;
					self.start();
				},
				error: function() {
					throw new Error('We were unable to download the chunks from the url provided: ' + self.settings.chunksUrl);
				}
			});
		} else {
			this.start();
		}

		// Chaining.
		return this;
	};

})();
