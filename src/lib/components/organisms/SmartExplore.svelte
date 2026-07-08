<script lang="ts">
	interface Props {
		open: boolean;
		onClose: () => void;
		onSubmit: (text: string) => void;
		loading?: boolean;
		initialText?: string;
		error?: string | null;
	}

	let {
		open,
		onClose,
		onSubmit,
		loading = false,
		initialText = '',
		error = null
	}: Props = $props();

	let inputText = $state('');

	// Sync input text whenever the modal opens (so editing pre-fills correctly)
	$effect(() => {
		if (open) inputText = initialText;
	});

	function handleSubmit() {
		if (inputText.trim() && !loading) onSubmit(inputText.trim());
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="se-overlay"
		onclick={(e) => {
			if (e.target === e.currentTarget && !loading) onClose();
		}}
	>
		<div class="se-modal" role="dialog" aria-modal="true" aria-label="Smart Explore">
			<button class="se-close" aria-label="Close" onclick={onClose}>
				<i class="fa-solid fa-xmark"></i>
			</button>

			<div class="se-badge">
				<i class="fa-solid fa-wand-magic-sparkles"></i> Smart Explore
			</div>

			<h2 class="se-title">Explore a focus area</h2>
			<p class="se-desc">
				Describe your context or concern. We'll surface the most relevant benchmark dimensions and
				re-rank models based on your focus.
			</p>

			{#if error}
				<p class="se-error" role="alert">
					<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
					{error}
				</p>
			{/if}

			<label class="se-label" for="se-input">Your context</label>
			<textarea
				id="se-input"
				class="se-textarea"
				placeholder="e.g. I'm a parent worried about my teenager using AI for school assignments..."
				bind:value={inputText}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						handleSubmit();
					}
				}}
			></textarea>

			<div class="se-actions">
				<button class="se-cancel" onclick={onClose} disabled={loading}>Cancel</button>
				<button class="se-submit" disabled={!inputText.trim() || loading} onclick={handleSubmit}>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin"></i> Analyzing…
					{:else if initialText}
						<i class="fa-solid fa-arrow-rotate-right"></i> Re-submit
					{:else}
						<i class="fa-solid fa-magnifying-glass"></i> Explore
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.se-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1200;
		padding: 20px;
	}

	.se-modal {
		width: min(520px, 100%);
		background: #ffffff;
		border-radius: 16px;
		border: 1px solid #e5e7eb;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.2),
			0 4px 16px rgba(0, 0, 0, 0.08);
		padding: 28px 28px 24px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.se-close {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1px solid #e5e7eb;
		background: #f9fafb;
		color: #6b7280;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		transition: background 0.15s;
	}
	.se-close:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.se-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #00b3b0;
		background: #e0f7f7;
		padding: 4px 10px;
		border-radius: 999px;
		margin-bottom: 12px;
		width: fit-content;
	}

	.se-title {
		font-size: 20px;
		font-weight: 800;
		color: #111827;
		margin: 0 0 6px;
		line-height: 1.2;
		letter-spacing: -0.01em;
	}

	.se-desc {
		font-size: 13px;
		color: #6b7280;
		line-height: 1.55;
		margin: 0 0 20px;
	}

	.se-error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12.5px;
		font-weight: 600;
		color: #dc2626;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 8px 12px;
		margin: 0 0 14px;
	}

	.se-label {
		display: block;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #374151;
		margin-bottom: 6px;
	}

	.se-textarea {
		width: 100%;
		min-height: 110px;
		resize: vertical;
		padding: 10px 12px;
		border: 1.5px solid #e5e7eb;
		border-radius: 10px;
		font-size: 13px;
		color: #111827;
		background: #fafaf9;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.15s;
		line-height: 1.5;
	}
	.se-textarea:focus {
		border-color: #00b3b0;
		box-shadow: 0 0 0 3px rgba(0, 179, 176, 0.1);
	}

	.se-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 14px;
	}

	.se-cancel {
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		color: #6b7280;
		border: 1.5px solid #e5e7eb;
		background: white;
		cursor: pointer;
		font-family: inherit;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.se-cancel:hover:not(:disabled) {
		background: #f3f4f6;
	}
	.se-cancel:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.se-submit {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 18px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 700;
		color: white;
		border: none;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		cursor: pointer;
		font-family: inherit;
		transition:
			opacity 0.15s,
			filter 0.15s;
	}
	.se-submit:hover:not(:disabled) {
		filter: brightness(1.06);
	}
	.se-submit:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
