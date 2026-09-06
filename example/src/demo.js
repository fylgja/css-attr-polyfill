/**
 * Demo markup, shared by both pages so the only difference between them is which
 * stylesheet they load. Edit the values here and the compiler picks them up.
 */
const MARKUP = `
	<section>
		<h2>Spacing, <code>type(&lt;number&gt;)</code></h2>
		<p class="hint">Padding is <code>calc(var(--spacing) * attr(data-p ...))</code>.</p>
		<div class="row">
			<span class="chip" data-p="1">1</span>
			<span class="chip" data-p="2">2</span>
			<span class="chip" data-p="3">3</span>
			<span class="chip" data-p="5">5</span>
			<span class="chip" data-p="8">8</span>
		</div>
	</section>

	<section>
		<h2>Sizing, one attribute driving two properties</h2>
		<div class="row baseline">
			<span class="box" data-size="4"></span>
			<span class="box" data-size="7"></span>
			<span class="box" data-size="10"></span>
			<span class="box" data-size="14"></span>
		</div>
	</section>

	<section>
		<h2>Lengths, from an in-CSS annotation</h2>
		<p class="hint">No markup scanning needed. The range lives in a CSS comment.</p>
		<div class="row baseline">
			<span class="box tinted" data-radius="0px"></span>
			<span class="box tinted" data-radius="4px"></span>
			<span class="box tinted" data-radius="10px"></span>
			<span class="box tinted" data-radius="999px"></span>
		</div>
	</section>

	<section>
		<h2>Colours, <code>type(&lt;color&gt;)</code></h2>
		<div class="row">
			<span class="box" data-size="7" data-tint="#f5c542"></span>
			<span class="box" data-size="7" data-tint="#8ec07c"></span>
			<span class="box" data-size="7" data-tint="#d98a8a"></span>
			<span class="box" data-size="7" data-tint="rebeccapurple"></span>
		</div>
	</section>

	<section>
		<h2>Strings on a pseudo-element</h2>
		<p class="hint">Generates <code>:where([data-label="..."])::after</code>, inserted before the pseudo-element.</p>
		<div class="row">
			<span class="chip labelled" data-p="2" data-label="new"></span>
			<span class="chip labelled" data-p="2" data-label="beta"></span>
		</div>
	</section>

	<section>
		<h2>Inside a media query</h2>
		<p class="hint">Padding grows at 40rem. The fallback is generated inside the same <code>@media</code>.</p>
		<div class="row">
			<span class="chip" data-md-p="6">resize me</span>
		</div>
	</section>
`;

/**
 * Render the demo into a container.
 *
 * @param {string} selector
 */
export function renderDemo(selector) {
	document.querySelector(selector).innerHTML = MARKUP;
}
