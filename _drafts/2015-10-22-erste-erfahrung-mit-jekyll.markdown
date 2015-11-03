---
layout:     post
title:      Entstehung dieses Blogs
excerpt:    Wie es zu diesem Blog kam und warum er mit Jekyll gebaut ist.
image:      html.jpeg
date:       2015-10-22 20:00:00
categories: Webseite
author:     Marco Pfeiffer
---

## Eigentlicher Plan
Eigentlich wollte ich nur einen Server aufsetzen um kleinere Witz-Seiten wie [is it friday yet] zu erstellen und ein wenig mit php Konfigurationen zu spielen. Ursprünglich hatte ich auch geplant irgend eine art Demo-Sammlung für Html/CSS/Javascript basteleien auf dem hauptdomain [marco.zone] zu legen, aber wirklich gedanken hatte ich mir nicht dazu gemacht.

Die Sache, die das dann etwas gestürzt hatte, war [DigitalOcean]s Linux Vms. Ich hatte mich für den Anbieter entschieden, da er recht günstig war und ich auch schon gutes gehört habe (schnell etc.). Außerdem wollte ich den Server selbst einrichten, auch wenn es einige Shared-Hoster gibt die eigentlich logisch für die Aufgabe gewesen wären. Mein Plan war es einen apache-worker mit php-fpm zu verwenden. Apache eigentlich nur wegen der .htaccess welche, trotz all den performance problemen dadurch, super praktisch ist um die Serverconfiguration mit in den Projekten ab zu legen. Aber irgendwie wollte ich kein mod-php benutzen, php-fpm und seine gewalltigen Konfigurationsmöglichkeiten haben mich einfach an gesprochen. ;)

Naja das "Problem" was dabei entstanden ist, ist dass das Packet `libapache2-mod-fastcgi` in den Packetquellen von Ubuntu nur bei multiverse dabei ist. Dies ist standartmäßig bei [DigitalOcean] deaktiviert. Bevor ich die Quelle blind ein gebaut hab, hab ich einen Augenblick über [die Beschreibung von multiverse] nach gedacht. Keine freie Lizens und vor allem: keine Betreung.

Perfektionistisch wie ich bin, hab ich damit den weg abgehackt und mich nach alternativen umgesehen. Apache bietet wohl das modul `libapache2-mod-fcgid`, aber dies hat ist wohl keine vollständige fastcgi implementation und funktioniert nicht mit php-fpm zusammen. Nginx funktioniert direkt mit fastcgi, allerdings verliere ich dann die `.htaccess`. Selbst auf deren Webseite werden die [nachteile von .htaccess] ausgeläuchtet und warum sowas nicht unterstützt wird.

Somit hab ich noch über eine wietere Möglichkeit nach gedacht. Was wäre, wenn ich php komplett weg lasse? Natürlich würden meine vorherigen Pläne mit dynamischen Witz Seiten weg fallen, aber ich war dennoch neugierig und hab nach Möglichkeiten gesucht. Dabei habe ich [StaticGen] gefunden, welches eine schöne Übersicht an Tools zum generieren statischer Seiten bietet. Direkt das erste raus gesucht, fest gestellt das es von GitHub verwendet wird und BAM: ich musste es aus probieren.

[is it friday yet]: http://isitfridayyet.net/
[marco.zone]: http://marco.zone/
[DigitalOcean]: https://www.digitalocean.com/?refcode=44bae78c77f9
[die Beschreibung von multiverse]: https://wiki.ubuntuusers.de/paketquellen#multiverse
[nachteile von .htaccess]: https://www.nginx.com/resources/wiki/start/topics/examples/likeapache-htaccess/
[StaticGen]: https://www.staticgen.com/