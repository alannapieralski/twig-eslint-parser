<?php

declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Twig\Environment;
use Twig\Error\SyntaxError;
use Twig\Lexer;
use Twig\Loader\ArrayLoader;
use Twig\Source;
use Twig\Token;

const USAGE = "Usage:\n"
    . "  php tools/twig-oracle/tokenize.php <fixtures directory>  write <name>.tokens.json beside each <name>.twig\n"
    . "  php tools/twig-oracle/tokenize.php --stdin               read template paths from stdin, print one JSON line each\n";

if ($argc !== 2 || ($argv[1] !== '--stdin' && !is_dir($argv[1]))) {
    fwrite(STDERR, USAGE);
    exit(1);
}

$environment = new Environment(new ArrayLoader([]));
$twigVersion = Environment::VERSION;

function sourceLengthAt(Token $token, string $code): ?int
{
    $pattern = match ($token->getType()) {
        Token::NAME_TYPE, Token::PUNCTUATION_TYPE => '/' . preg_quote((string) $token->getValue(), '/') . '/A',
        Token::OPERATOR_TYPE => '/' . str_replace(' ', '\s+', preg_quote((string) $token->getValue(), '/')) . '/A',
        Token::NUMBER_TYPE => Lexer::REGEX_NUMBER,
        default => null,
    };
    if ($pattern === null) {
        return null;
    }
    if (preg_match($pattern, $code, $match, 0, $token->getOffset()) !== 1) {
        throw new LogicException(sprintf('Twig emitted %s at offset %d, but its source does not match there.', $token, $token->getOffset()));
    }

    return strlen($match[0]);
}

function describeToken(Token $token, string $code): array
{
    $description = [
        'type' => Token::typeToEnglish($token->getType()),
        'value' => $token->getValue(),
        'line' => $token->getLine(),
        'offset' => $token->getOffset(),
    ];
    $length = sourceLengthAt($token, $code);

    return $length === null ? $description : $description + ['end' => $token->getOffset() + $length];
}

function tokenizeTemplate(Environment $environment, string $name, string $code): array
{
    try {
        $stream = $environment->tokenize(new Source($code, $name));
    } catch (SyntaxError $error) {
        return ['error' => $error->getRawMessage(), 'line' => $error->getTemplateLine()];
    }

    $tokens = [];
    while (true) {
        $token = $stream->getCurrent();
        $tokens[] = describeToken($token, $code);
        if ($token->test(Token::EOF_TYPE)) {
            return ['tokens' => $tokens];
        }
        $stream->next();
    }
}

if ($argv[1] === '--stdin') {
    while (($path = fgets(STDIN)) !== false) {
        $path = trim($path);
        if ($path === '') {
            continue;
        }
        $result = ['path' => $path, 'twig' => $twigVersion] + tokenizeTemplate($environment, basename($path), file_get_contents($path));
        fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n");
    }
    exit(0);
}

$fixtureFiles = glob(rtrim($argv[1], '/') . '/*.twig');
sort($fixtureFiles);

foreach ($fixtureFiles as $fixtureFile) {
    $name = basename($fixtureFile);
    $golden = ['twig' => $twigVersion] + tokenizeTemplate($environment, $name, file_get_contents($fixtureFile));
    $goldenFile = preg_replace('/\.twig$/', '.tokens.json', $fixtureFile);
    file_put_contents($goldenFile, json_encode($golden, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
    fwrite(STDOUT, sprintf("%s -> %s\n", $name, isset($golden['error']) ? 'error: ' . $golden['error'] : count($golden['tokens']) . ' tokens'));
}
