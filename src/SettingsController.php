<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Psr\Http\Message\{ResponseInterface, ServerRequestInterface};

final readonly class SettingsController
{
    public function __construct(private ResponseFactoryInterface $responses, private RequestInput $input) {}

    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $store = new SettingsStore();
        if ($request->getMethod() === 'GET') {
            return $this->json(['settings' => ['allow_html_import' => $store->load()['allow_html_import']]]);
        }

        $body = $this->input->all($request);
        if (!is_array($body) || !is_bool($body['allow_html_import'] ?? null)) {
            return $this->json(['error' => ['message' => 'Изберете дали да се разреши импорт на външен HTML.']], 422);
        }

        $settings = $store->load();
        $store->save($settings['defaults'], $settings['button_styles'], $body['allow_html_import']);

        return $this->json(['settings' => ['allow_html_import' => $body['allow_html_import']]]);
    }

    /** @param array<string, mixed> $payload */
    private function json(array $payload, int $status = 200): ResponseInterface
    {
        return $this->responses->json($payload, $status, ['Cache-Control' => 'no-store']);
    }
}
