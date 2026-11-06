// Find our date picker inputs.
const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");

// Use the existing dateRange.js helper.
setupDateInputs(startInput, endInput);

// Find the rest of our page elements.
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

// Replace DEMO_KEY with your own NASA API key if needed.
const apiKey = "DEMO_KEY";

// Extra credit: pick a random fact on each page load.
const spaceFacts = [
  "Sunlight takes about eight minutes to reach Earth.",
  "Venus takes longer to rotate once than to orbit the Sun.",
  "Jupiter is the largest planet in our solar system.",
  "The Moon's gravity causes much of Earth's ocean tides.",
  "A light-year measures distance, not time.",
  "Mars has two moons, named Phobos and Deimos."
];

const randomIndex = Math.floor(Math.random() * spaceFacts.length);
// Show one of the facts chosen at random.
document.getElementById("spaceFact").textContent =
  spaceFacts[randomIndex];

// Format dates without shifting them into a different day.
function formatDate(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

// Accept only ordinary web URLs from API data.
function safeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    // Invalid or missing URL.
  }

  return "";
}

// NASA's newer responses put the image in hdurl.
// Older responses may also have an image in url.
function getImageUrl(item) {
  return safeUrl(
    item.hdurl || (!item.permalink ? item.url : "")
  );
}

// Request images when the user submits the date form.
dateForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const startDate = startInput.value;
  const endDate = endInput.value;

  statusMessage.classList.remove("error");

  // Check that both dates are inside the allowed range.
  if (!dateForm.reportValidity()) {
    return;
  }

  if (startDate > endDate) {
    statusMessage.textContent =
      "Please choose an end date on or after the start date.";
    statusMessage.classList.add("error");
    return;
  }

  // Show a loading message and clear previous results.
  gallery.replaceChildren();
  gallery.setAttribute("aria-busy", "true");
  statusMessage.textContent = "🔄 Loading space photos…";
  getImagesButton.disabled = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    // Add the API key and selected dates to the request URL.
    const parameters = new URLSearchParams({
      api_key: apiKey,
      start_date: startDate,
      end_date: endDate
    });

    // Ask NASA for the images between the selected dates.
    const response = await fetch(
      "https://api.nasa.gov/planetary/apod?" + parameters,
      { signal: controller.signal }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "NASA's request limit was reached. Try again later " +
          "or replace DEMO_KEY with your own NASA API key."
        );
      }

      throw new Error(
        "NASA could not load these dates. Check your API key " +
        "or try a shorter date range. Error: " + response.status
      );
    }

    // Convert NASA's JSON response into JavaScript data.
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("NASA returned an unexpected response.");
    }

    // Display newest entries first, then build the gallery.
    data.sort((a, b) => b.date.localeCompare(a.date));

    displayGallery(data);

    statusMessage.textContent = data.length
      ? `${data.length} space entries loaded. Click one to learn more!`
      : "No entries found. Try another date range.";
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

// Build the gallery from NASA's response.
function displayGallery(items) {
  gallery.replaceChildren();

  // Create one clickable card for each entry from NASA.
  items.forEach(function (item) {
    // A button makes the entire card clickable and keyboard accessible.
    const card = document.createElement("button");
    card.type = "button";
    card.className = "gallery-item";
    card.setAttribute("aria-haspopup", "dialog");

    const imageContainer = document.createElement("span");
    imageContainer.className = "image-container";

    const imageUrl =
      item.media_type === "image" ? getImageUrl(item) : "";

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.title;
      image.loading = "lazy";

      // Handle an image URL that fails to load.
      image.addEventListener("error", function () {
        imageContainer.replaceChildren(
          createMediaPlaceholder("Image unavailable — view details")
        );
      });

      imageContainer.appendChild(image);
    } else {
      const label = item.media_type === "image"
        ? "Image unavailable — view details"
        : "▶ Video / media — click to view";

      imageContainer.appendChild(createMediaPlaceholder(label));
    }

    const title = document.createElement("strong");
    title.className = "card-title";
    title.textContent = item.title;

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

function createMediaPlaceholder(message) {
  const placeholder = document.createElement("span");
  placeholder.className = "media-placeholder";
  placeholder.textContent = message;
  return placeholder;
}

// Show the selected entry's full details.
function openModal(item) {
  modalTitle.textContent = item.title;
  modalDate.textContent = formatDate(item.date);
  modalExplanation.textContent =
    item.explanation || "No explanation is available.";
  modalCredit.textContent = item.copyright
    ? "Image credit: " + item.copyright
    : "";

  // Remove the previously selected image or video link.
  modalMedia.replaceChildren();

  if (item.media_type === "image") {
    const imageUrl = getImageUrl(item);

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.title;

      image.addEventListener("error", function () {
        const message = document.createElement("p");
        message.textContent = "This image could not be loaded.";
        image.replaceWith(message);
      });

      modalMedia.appendChild(image);
    } else {
      modalMedia.textContent = "No image is available for this entry.";
    }
  } else {
    // Extra credit: clearly link to videos and other media.
    const videoUrl = safeUrl(item.permalink || item.url);

    if (videoUrl) {
      const videoLink = document.createElement("a");
      videoLink.href = videoUrl;
      videoLink.target = "_blank";
      videoLink.rel = "noopener noreferrer";
      videoLink.className = "video-link";
      videoLink.textContent = "▶ Open video / media in a new tab";
      modalMedia.appendChild(videoLink);
    } else {
      modalMedia.textContent = "No media link is available.";
    }
  }

  modal.showModal();
  modal.scrollTop = 0;
}

// Close using the visible button.
closeModalButton.addEventListener("click", function () {
  modal.close();
});

// Close when clicking the backdrop outside the modal.
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

// Escape-to-close is built into the native <dialog> element.