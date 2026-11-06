// ========================================
// DATE INPUTS
// ========================================

const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");

// Use the provided dateRange.js helper.
setupDateInputs(startInput, endInput);


// ========================================
// PAGE ELEMENTS
// ========================================

const dateForm = document.getElementById("dateForm");
const gallery = document.getElementById("gallery");
const getImagesButton = document.getElementById("getImages");
const statusMessage = document.getElementById("status");

const modal = document.getElementById("imageModal");
const closeModalButton = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalDate = document.getElementById("modalDate");
const modalMedia = document.getElementById("modalMedia");
const modalExplanation = document.getElementById("modalExplanation");
const modalCredit = document.getElementById("modalCredit");


// ========================================
// RANDOM SPACE FACT
// ========================================

const spaceFacts = [
  "Sunlight takes about eight minutes to reach Earth.",
  "Venus takes longer to rotate once than to orbit the Sun.",
  "Jupiter is the largest planet in our solar system.",
  "The Moon's gravity causes much of Earth's ocean tides.",
  "A light-year measures distance, not time.",
  "Mars has two moons, named Phobos and Deimos."
];

const randomIndex = Math.floor(Math.random() * spaceFacts.length);

document.getElementById("spaceFact").textContent =
  spaceFacts[randomIndex];


// ========================================
// HELPER FUNCTIONS
// ========================================

// Display dates in a readable format.
function formatDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

// NASA's explanations can contain HTML.
// Convert it to text instead of inserting HTML into our page.
function plainText(value) {
  const parsedDocument = new DOMParser().parseFromString(
    String(value || "").replace(/<br\s*\/?>/gi, "\n"),
    "text/html"
  );

  return parsedDocument.body.textContent.trim();
}

// Allow only normal web addresses.
function safeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    // Missing or invalid URL.
  }

  return "";
}

// The APOD Basic feed stores the image address in hdurl.
// Its url field points to the NASA article, not the image.
function getImageUrl(item) {
  return safeUrl(item.hdurl);
}

// Create a message for video entries or unavailable images.
function createMediaPlaceholder(message) {
  const placeholder = document.createElement("span");
  placeholder.className = "media-placeholder";
  placeholder.textContent = message;

  return placeholder;
}


// ========================================
// FETCH NASA DATA
// ========================================

async function fetchSpaceEntries(startDate, endDate, signal) {
  // This feed expects dates in YYMMDD format.
  // Example: 2026-11-05 becomes 261105.
  const dateFrom = startDate.replaceAll("-", "").slice(2);
  const dateTo = endDate.replaceAll("-", "").slice(2);

  const entries = [];
  let page = 1;
  let totalPages = 1;

  // NASA returns up to 25 entries per page.
  // Fetch additional pages for longer date ranges.
  do {
    const parameters = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      per_page: "25",
      page: String(page)
    });

    const response = await fetch(
      "https://science.nasa.gov/wp-json/wp/v2/apod-basic?" +
        parameters,
      { signal }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "NASA is receiving too many requests. Please try again later."
        );
      }

      throw new Error(
        "NASA could not load these dates. Please try again. " +
        "Error: " + response.status
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("NASA returned an unexpected response.");
    }

    entries.push(...data);

    totalPages = Number(
      response.headers.get("X-WP-TotalPages") || 1
    );

    page++;
  } while (page <= totalPages);

  // Clean the text while preserving image and video information.
  return entries.map(function (item) {
    return {
      ...item,
      title: plainText(item.title),
      explanation: plainText(item.explanation),
      copyright: plainText(item.copyright || item.credit)
    };
  });
}


// ========================================
// GET SPACE IMAGES BUTTON
// ========================================

dateForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const startDate = startInput.value;
  const endDate = endInput.value;

  statusMessage.classList.remove("error");

  // Check required dates and the allowed date limits.
  if (!dateForm.reportValidity()) {
    return;
  }

  if (startDate > endDate) {
    statusMessage.textContent =
      "Please choose an end date on or after the start date.";

    statusMessage.classList.add("error");
    endInput.focus();
    return;
  }

  // Remove the initial placeholder or previous results.
  gallery.replaceChildren();
  gallery.setAttribute("aria-busy", "true");

  statusMessage.textContent = "🔄 Loading space photos…";
  getImagesButton.disabled = true;

  // Stop the request if NASA takes longer than 45 seconds.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const data = await fetchSpaceEntries(
      startDate,
      endDate,
      controller.signal
    );

    // Show the newest entries first.
    data.sort((a, b) => b.date.localeCompare(a.date));

    displayGallery(data);

    statusMessage.textContent = data.length
      ? `${data.length} space entries loaded. Click one to learn more!`
      : "No published entries found. Try an earlier date range.";
  } catch (error) {
    statusMessage.classList.add("error");

    if (error.name === "AbortError") {
      statusMessage.textContent =
        "NASA took too long to respond. Try a shorter date range.";
    } else if (error instanceof TypeError) {
      statusMessage.textContent =
        "Unable to connect to NASA. Check your internet connection.";
    } else {
      statusMessage.textContent = error.message;
    }
  } finally {
    clearTimeout(timeout);
    getImagesButton.disabled = false;
    gallery.setAttribute("aria-busy", "false");
  }
});


// ========================================
// DISPLAY THE GALLERY
// ========================================

function displayGallery(items) {
  // Replace previous cards whenever new results load.
  gallery.replaceChildren();

  items.forEach(function (item) {
    // A button allows mouse and keyboard users to open the card.
    const card = document.createElement("button");
    card.type = "button";
    card.className = "gallery-item";
    card.setAttribute("aria-haspopup", "dialog");

    const imageContainer = document.createElement("span");
    imageContainer.className = "image-container";

    if (item.media_type === "image") {
      const imageUrl = getImageUrl(item);

      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = item.title || "Astronomy Picture of the Day";
        image.loading = "lazy";

        image.addEventListener("error", function () {
          imageContainer.replaceChildren(
            createMediaPlaceholder(
              "Image unavailable — click for details"
            )
          );
        });

        imageContainer.appendChild(image);
      } else {
        imageContainer.appendChild(
          createMediaPlaceholder(
            "Image unavailable — click for details"
          )
        );
      }
    } else {
      // Video and interactive entries still get a clickable card.
      imageContainer.appendChild(
        createMediaPlaceholder("▶ Video / media — click to view")
      );
    }

    const title = document.createElement("strong");
    title.className = "card-title";
    title.textContent = item.title || "Astronomy Picture of the Day";

    const date = document.createElement("span");
    date.className = "card-date";
    date.textContent = formatDate(item.date);

    card.append(imageContainer, title, date);

    card.addEventListener("click", function () {
      openModal(item);
    });

    gallery.appendChild(card);
  });
}


// ========================================
// OPEN THE MODAL
// ========================================

function openModal(item) {
  modalTitle.textContent =
    item.title || "Astronomy Picture of the Day";

  modalDate.textContent = formatDate(item.date);

  modalExplanation.textContent =
    item.explanation || "No explanation is available.";

  modalCredit.textContent = item.copyright
    ? "Image credit: " + item.copyright
    : "";

  // Remove content from the previously opened entry.
  modalMedia.replaceChildren();

  if (item.media_type === "image") {
    const imageUrl = getImageUrl(item);

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.title || "Astronomy Picture of the Day";

      image.addEventListener("error", function () {
        const message = document.createElement("p");
        message.textContent = "This image could not be loaded.";
        image.replaceWith(message);
      });

      modalMedia.appendChild(image);
    } else {
      modalMedia.textContent =
        "No image is available for this entry.";
    }
  } else {
    // NASA's article page lets the user access the video.
    const videoUrl = safeUrl(item.permalink || item.url);

    if (videoUrl) {
      const videoLink = document.createElement("a");
      videoLink.href = videoUrl;
      videoLink.target = "_blank";
      videoLink.rel = "noopener noreferrer";
      videoLink.className = "video-link";
      videoLink.textContent =
        "▶ Open video / media in a new tab";

      modalMedia.appendChild(videoLink);
    } else {
      modalMedia.textContent =
        "No media link is available for this entry.";
    }
  }

  modal.showModal();
  modal.scrollTop = 0;
}


// ========================================
// CLOSE THE MODAL
// ========================================

// Close with the X button.
closeModalButton.addEventListener("click", function () {
  modal.close();
});

// Close when clicking outside the modal.
modal.addEventListener("click", function (event) {
  const bounds = modal.getBoundingClientRect();

  const clickedOutside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (event.target === modal && clickedOutside) {
    modal.close();
  }
});

// The HTML <dialog> also closes when the user presses Escape.