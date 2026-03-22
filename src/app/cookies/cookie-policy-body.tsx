import * as React from "react";

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ lineHeight: 1.5 }}>
      <span style={{ color: "rgb(127, 127, 127)" }}>
        <span style={{ color: "rgb(89, 89, 89)", fontSize: 15 }}>
          <span data-custom-class="body_text">{children}</span>
        </span>
      </span>
    </div>
  );
}

function Heading1({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ lineHeight: 1.5 }}>
      <span style={{ color: "rgb(127, 127, 127)" }}>
        <span style={{ color: "rgb(0, 0, 0)", fontSize: 15 }}>
          <strong>
            <span data-custom-class="heading_1">
              <h2>{children}</h2>
            </span>
          </strong>
        </span>
      </span>
    </div>
  );
}

const analyticsTableHtml = `<section data-custom-class="body_text" style="width: 100%; border: 1px solid #e6e6e6; margin: 0 0 10px; border-radius: 3px;"><div style="padding: 8px 13px; border-bottom: 1px solid #e6e6e6;"><table><tbody><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: #19243c; min-width: 80px; font-weight: normal;">Name:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">s7</span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0; vertical-align: top;"><th style="text-align: right; color: #19243c; min-width: 80px; font-weight: normal;">Purpose:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">Gather data regarding site usage and user behavior on the website.</span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: #19243c; min-width: 80px; font-weight: normal;">Provider:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">studara.org</span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: rgb(25, 36, 60); min-width: 80px; font-weight: normal;">Service:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">Adobe Analytics </span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: #19243c; min-width: 80px; font-weight: normal;">Type:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">server_cookie</span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: #19243c; min-width: 80px; font-weight: normal;">Expires in:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">session</span></td></tr></tbody></table></div></section>`;

const unclassifiedTableHtml = `<section data-custom-class="body_text" style="width: 100%; border: 1px solid #e6e6e6; margin: 0 0 10px; border-radius: 3px;"><div style="padding: 8px 13px; border-bottom: 1px solid #e6e6e6;"><table><tbody><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: rgb(25, 36, 60); min-width: 80px; font-weight: normal;">Name:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">__Secure-next-auth.callback-url</span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: rgb(25, 36, 60); min-width: 80px; font-weight: normal;">Provider:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">studara.org</span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: #19243c; min-width: 80px; font-weight: normal;">Type:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">server_cookie</span></td></tr><tr style="font-family: Roboto, Arial; font-size: 12px; line-height: 1.67; margin: 0 0 8px; vertical-align: top;"><th style="text-align: right; color: #19243c; min-width: 80px; font-weight: normal;">Expires in:</th><td style="display: inline-block; margin-left: 5px;"><span style="color: #8b93a7; word-break: break-all;">session</span></td></tr></tbody></table></div></section>`;

export function CookiePolicyBody() {
  return (
    <div data-custom-class="body">
      <div>
        <strong>
          <span style={{ fontSize: 26 }}>
            <span data-custom-class="title">
              <h1>COOKIE POLICY</h1>
            </span>
          </span>
        </strong>
      </div>
      <div>
        <span style={{ color: "rgb(127, 127, 127)" }}>
          <strong>
            <span style={{ fontSize: 15 }}>
              <span data-custom-class="subtitle">Last updated March 22, 2026</span>
            </span>
          </strong>
        </span>
      </div>
      <div>
        <br />
      </div>
      <div>
        <br />
      </div>
      <div>
        <br />
      </div>

      <BodyText>
        This Cookie Policy explains how <strong>Studara</strong> (&quot;<strong>Company</strong>,&quot; &quot;
        <strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; and &quot;<strong>our</strong>&quot;) uses cookies and
        similar technologies to recognize you when you visit our website at{" "}
        <a target="_blank" data-custom-class="link" href="https://studara.org" rel="noopener noreferrer">
          https://studara.org
        </a>{" "}
        (&quot;<strong>Website</strong>&quot;). It explains what these technologies are and why we use them, as well as
        your rights to control our use of them.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <BodyText>
        In some cases we may use cookies to collect personal information, or that becomes personal information if we
        combine it with other information.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>

      <Heading1>What are cookies?</Heading1>
      <BodyText>
        Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies
        are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to
        provide reporting information.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <BodyText>
        Cookies set by the website owner (in this case, <strong>Studara</strong>) are called &quot;first-party
        cookies.&quot; Cookies set by parties other than the website owner are called &quot;third-party cookies.&quot;
        Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g.,
        advertising, interactive content, and analytics). The parties that set these third-party cookies can recognize
        your computer both when it visits the website in question and also when it visits certain other websites.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>

      <Heading1>Why do we use cookies?</Heading1>
      <BodyText>
        We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order
        for our Website to operate, and we refer to these as &quot;essential&quot; or &quot;strictly necessary&quot;
        cookies. Other cookies also enable us to track and target the interests of our users to enhance the experience on
        our Online Properties. Third parties serve cookies through our Website for advertising, analytics, and other
        purposes. This is described in more detail below.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>

      <Heading1>How can I control cookies?</Heading1>
      <div style={{ lineHeight: 1.5 }}>
        <span style={{ fontSize: 15, color: "rgb(89, 89, 89)" }}>
          <span data-custom-class="body_text">
            You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by
            setting your preferences in the Cookie Preference Center. The Cookie Preference Center allows you to select
            which categories of cookies you accept or reject. Essential cookies cannot be rejected as they are strictly
            necessary to provide you with services.
          </span>
        </span>
      </div>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <div style={{ lineHeight: 1.5 }}>
        <span style={{ fontSize: 15, color: "rgb(89, 89, 89)" }}>
          <span data-custom-class="body_text">
            The Cookie Preference Center can be found in the notification banner and on our Website. If you choose to
            reject cookies, you may still use our Website though your access to some functionality and areas of our
            Website may be restricted. You may also set or amend your web browser controls to accept or refuse cookies.
          </span>
        </span>
      </div>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <div style={{ lineHeight: 1.5 }}>
        <span style={{ fontSize: 15, color: "rgb(89, 89, 89)" }}>
          <span data-custom-class="body_text">
            The specific types of first- and third-party cookies served through our Website and the purposes they perform
            are described in the table below (please note that the specific cookies served may vary depending on the
            specific Online Properties you visit):
          </span>
        </span>
        <span data-custom-class="heading_2" style={{ color: "rgb(0, 0, 0)" }}>
          <span style={{ fontSize: 15 }}>
            <strong>
              <u>
                <br />
                <h3>Analytics and customization cookies:</h3>
              </u>
            </strong>
          </span>
        </span>
        <span style={{ color: "rgb(127, 127, 127)" }}>
          <span style={{ color: "rgb(89, 89, 89)", fontSize: 15 }}>
            <span data-custom-class="body_text">
              These cookies collect information that is used either in aggregate form to help us understand how our
              Website is being used or how effective our marketing campaigns are, or to help us customize our Website
              for you.
            </span>
          </span>
        </span>
      </div>
      <div>
        <br />
      </div>
      <div
        style={{ lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{ __html: analyticsTableHtml }}
      />
      <span data-custom-class="heading_2" style={{ color: "rgb(0, 0, 0)" }}>
        <span style={{ fontSize: 15 }}>
          <strong>
            <u>
              <br />
              <h3>Unclassified cookies:</h3>
            </u>
          </strong>
        </span>
      </span>
      <span style={{ color: "rgb(127, 127, 127)" }}>
        <span style={{ color: "rgb(89, 89, 89)", fontSize: 15 }}>
          <span data-custom-class="body_text">
            These are cookies that have not yet been categorized. We are in the process of classifying these cookies with
            the help of their providers.
          </span>
        </span>
      </span>
      <div>
        <br />
      </div>
      <div dangerouslySetInnerHTML={{ __html: unclassifiedTableHtml }} />

      <Heading1>How can I control cookies on my browser?</Heading1>
      <div style={{ lineHeight: 1.5 }}>
        <span data-custom-class="body_text">
          As the means by which you can refuse cookies through your web browser controls vary from browser to browser,
          you should visit your browser&apos;s help menu for more information. The following is information about how to
          manage cookies on the most popular browsers:
        </span>
      </div>
      <ul style={{ lineHeight: 1.5 }}>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a
              data-custom-class="link"
              href="https://support.google.com/chrome/answer/95647#zippy=%2Callow-or-block-cookies"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span style={{ fontSize: 15 }}>Chrome</span>
            </a>
          </span>
        </li>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a
              data-custom-class="link"
              href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span style={{ fontSize: 15 }}>Internet Explorer</span>
            </a>
          </span>
        </li>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a
              data-custom-class="link"
              href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop?redirectslug=enable-and-disable-cookies-website-preferences&redirectlocale=en-US"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span style={{ fontSize: 15 }}>Firefox</span>
            </a>
          </span>
        </li>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a
              data-custom-class="link"
              href="https://support.apple.com/en-ie/guide/safari/sfri11471/mac"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span style={{ fontSize: 15 }}>Safari</span>
            </a>
          </span>
        </li>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a
              data-custom-class="link"
              href="https://support.microsoft.com/en-us/windows/microsoft-edge-browsing-data-and-privacy-bb8174ba-9d73-dcf2-9b4a-c582b4e640dd"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span style={{ fontSize: 15 }}>Edge</span>
            </a>
          </span>
        </li>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a data-custom-class="link" href="https://help.opera.com/en/latest/web-preferences/" rel="noopener noreferrer" target="_blank">
              <span style={{ fontSize: 15 }}>Opera</span>
            </a>
          </span>
        </li>
      </ul>
      <div style={{ lineHeight: 1.5 }}>
        <span data-custom-class="body_text">
          In addition, most advertising networks offer you a way to opt out of targeted advertising. If you would like
          to find out more information, please visit:
        </span>
      </div>
      <ul style={{ lineHeight: 1.5 }}>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a data-custom-class="link" href="http://www.aboutads.info/choices/" rel="noopener noreferrer" target="_blank">
              <span style={{ fontSize: 15 }}>Digital Advertising Alliance</span>
            </a>
          </span>
        </li>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a data-custom-class="link" href="https://youradchoices.ca/" rel="noopener noreferrer" target="_blank">
              <span style={{ color: "rgb(0, 58, 250)", fontSize: 15 }}>Digital Advertising Alliance of Canada</span>
            </a>
          </span>
        </li>
        <li>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a data-custom-class="link" href="http://www.youronlinechoices.com/" rel="noopener noreferrer" target="_blank">
              <span style={{ fontSize: 15 }}>European Interactive Digital Advertising Alliance</span>
            </a>
          </span>
        </li>
      </ul>
      <div>
        <br />
      </div>

      <div style={{ lineHeight: 1.5 }}>
        <strong>
          <span data-custom-class="heading_1">
            <h2>What about other tracking technologies, like web beacons?</h2>
          </span>
        </strong>
      </div>
      <BodyText>
        Cookies are not the only way to recognize or track visitors to a website. We may use other, similar technologies
        from time to time, like web beacons (sometimes called &quot;tracking pixels&quot; or &quot;clear gifs&quot;). These
        are tiny graphics files that contain a unique identifier that enables us to recognize when someone has visited
        our Website or opened an email including them. This allows us, for example, to monitor the traffic patterns of
        users from one page within a website to another, to deliver or communicate with cookies, to understand whether
        you have come to the website from an online advertisement displayed on a third-party website, to improve site
        performance, and to measure the success of email marketing campaigns. In many instances, these technologies are
        reliant on cookies to function properly, and so declining cookies will impair their functioning.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>

      <div style={{ lineHeight: 1.5 }}>
        <span data-custom-class="heading_1">
          <strong>
            <h2>Do you use Flash cookies or Local Shared Objects?</h2>
          </strong>
        </span>
      </div>
      <BodyText>
        Websites may also use so-called &quot;Flash Cookies&quot; (also known as Local Shared Objects or &quot;LSOs&quot;)
        to, among other things, collect and store information about your use of our services, fraud prevention, and for
        other site operations.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <div style={{ lineHeight: 1.5 }}>
        <span style={{ fontSize: 15, color: "rgb(89, 89, 89)" }}>
          <span data-custom-class="body_text">
            If you do not want Flash Cookies stored on your computer, you can adjust the settings of your Flash player to
            block Flash Cookies storage using the tools contained in the{" "}
          </span>
        </span>
        <span data-custom-class="body_text">
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a
              data-custom-class="link"
              href="http://www.macromedia.com/support/documentation/en/flashplayer/help/settings_manager07.html"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span style={{ fontSize: 15 }}>Website Storage Settings Panel</span>
            </a>
          </span>
          <span style={{ fontSize: 15, color: "rgb(89, 89, 89)" }}>. You can also control Flash Cookies by going to the </span>
          <span style={{ color: "rgb(0, 58, 250)" }}>
            <a
              data-custom-class="link"
              href="http://www.macromedia.com/support/documentation/en/flashplayer/help/settings_manager03.html"
              rel="noopener noreferrer"
              target="_blank"
            >
              <span style={{ fontSize: 15 }}>Global Storage Settings Panel</span>
            </a>
          </span>
          <span style={{ fontSize: 15, color: "rgb(89, 89, 89)" }}>
            <span data-custom-class="body_text">
              {" "}
              and following the instructions (which may include instructions that explain, for example, how to delete
              existing Flash Cookies (referred to &quot;information&quot; on the Macromedia site), how to prevent Flash LSOs
              from being placed on your computer without your being asked, and (for Flash Player 8 and later) how to block
              Flash Cookies that are not being delivered by the operator of the page you are on at the time).
            </span>
          </span>
        </span>
      </div>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <BodyText>
        Please note that setting the Flash Player to restrict or limit acceptance of Flash Cookies may reduce or impede the
        functionality of some Flash applications, including, potentially, Flash applications used in connection with our
        services or online content.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>

      <div style={{ lineHeight: 1.5 }}>
        <strong>
          <span data-custom-class="heading_1">
            <h2>Do you serve targeted advertising?</h2>
          </span>
        </strong>
      </div>
      <BodyText>
        Third parties may serve cookies on your computer or mobile device to serve advertising through our Website. These
        companies may use information about your visits to this and other websites in order to provide relevant
        advertisements about goods and services that you may be interested in. They may also employ technology that is
        used to measure the effectiveness of advertisements. They can accomplish this by using cookies or web beacons to
        collect information about your visits to this and other sites in order to provide relevant advertisements about
        goods and services of potential interest to you. The information collected through this process does not enable us or
        them to identify your name, contact details, or other details that directly identify you unless you choose to
        provide these.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>

      <div style={{ lineHeight: 1.5 }}>
        <strong>
          <span data-custom-class="heading_1">
            <h2>How often will you update this Cookie Policy?</h2>
          </span>
        </strong>
      </div>
      <BodyText>
        We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use
        or for other operational, legal, or regulatory reasons. Please therefore revisit this Cookie Policy regularly to
        stay informed about our use of cookies and related technologies.
      </BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <BodyText>The date at the top of this Cookie Policy indicates when it was last updated.</BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>

      <div style={{ lineHeight: 1.5 }}>
        <strong>
          <span data-custom-class="heading_1">
            <h2>Where can I get further information?</h2>
          </span>
        </strong>
      </div>
      <BodyText>If you have any questions about our use of cookies or other technologies, please contact us at:</BodyText>
      <div style={{ lineHeight: 1.5 }}>
        <br />
      </div>
      <div style={{ lineHeight: 1.5 }}>
        <span style={{ fontSize: 15, color: "rgb(89, 89, 89)" }}>
          <span data-custom-class="body_text">
            <a data-custom-class="link" href="mailto:studarausersupport@gmail.com">
              studarausersupport@gmail.com
            </a>
          </span>
        </span>
      </div>

      <div style={{ display: "none" }} aria-hidden>
        <a className="cookie123" href="https://app.termly.io/dsar/1bd7c05b-fb7a-4fd2-93ad-ec8a514b3281">
          &nbsp;
        </a>
      </div>
    </div>
  );
}
